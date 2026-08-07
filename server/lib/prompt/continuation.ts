/**
 * Conversation continuity — pending-question detection.
 *
 * The intent of a chat turn is a function of (message, conversation state), not of
 * (message) alone. A short message right after the assistant asked a question is a
 * reply — the single most common kind of short message in a chat — and classifying it
 * standalone throws away the whole request it was answering.
 *
 * Whoever asks a question owns recognizing the answer. This module is the state that
 * makes that possible: deterministic, no LLM, no new infra.
 */

import { isChatOnly, isGreeting } from './classifier.js';

export interface ConversationTurn {
  role: string;
  content: string;
}

export interface PendingTurn {
  /** The assistant's last message asked something and is still unanswered. */
  hasPendingQuestion: boolean;
  /** The question itself, trimmed for prompt injection. */
  question?: string;
  /** The last user message carrying real intent before the question ("Mockup de cartão de visita"). */
  pendingRequest?: string;
}

const NO_PENDING: PendingTurn = { hasPendingQuestion: false };

/** Assistant messages often bury the '?' mid-text ("qual marca? As opções são: ..."). */
const QUESTION_MARK = /\?/;
const INTERROGATIVE =
  /\b(qual|quais|quer|deseja|prefere|escolha|informe|me diga|which|what|would you like|please (choose|specify|tell))\b/i;

function asksSomething(content: string): boolean {
  return QUESTION_MARK.test(content) || INTERROGATIVE.test(content);
}

/**
 * Inspect history for an unanswered assistant question.
 *
 * Pending only when the assistant spoke last — if a user turn follows the question, it
 * was already answered (that turn is now history, not a pending slot).
 */
export function detectPendingTurn(history: ConversationTurn[]): PendingTurn {
  if (!history?.length) return NO_PENDING;

  const last = history[history.length - 1];
  if (last?.role !== 'assistant' || !last.content) return NO_PENDING;
  if (!asksSomething(last.content)) return NO_PENDING;

  // Walk back for the request the question was blocking on.
  let pendingRequest: string | undefined;
  for (let i = history.length - 2; i >= 0; i--) {
    const turn = history[i];
    if (turn?.role !== 'user' || !turn.content) continue;
    if (isChatOnly(turn.content)) continue; // "oi", "ok" — not the request
    pendingRequest = turn.content.trim();
    break;
  }

  return {
    hasPendingQuestion: true,
    question: last.content.trim().slice(0, 500),
    pendingRequest,
  };
}

/**
 * Is this message an answer to the pending question, rather than a new turn?
 *
 * Only messages that would otherwise be misclassified as pure chat qualify — a message
 * with its own design intent already classifies correctly and needs no rescue. Greetings
 * are never answers ("oi" does not answer "qual marca?").
 */
export function isReplyToPendingQuestion(command: string, pending: PendingTurn): boolean {
  if (!pending.hasPendingQuestion) return false;
  if (!command?.trim()) return false;
  if (isGreeting(command)) return false;
  return isChatOnly(command);
}

/**
 * Prompt module telling the model it is mid-dialog: the pending request is still the job,
 * and the current message is the missing piece — not an opening.
 */
export function buildContinuationContext(command: string, pending: PendingTurn): string {
  const lines = [
    '═══ CONTINUACAO DE DIALOGO ═══',
    'Voce fez uma pergunta e o usuario acabou de responde-la. Isto NAO e uma conversa nova.',
    '',
    `PERGUNTA QUE VOCE FEZ: "${pending.question}"`,
    `RESPOSTA DO USUARIO: "${command.trim()}"`,
  ];

  if (pending.pendingRequest) {
    lines.push(
      `PEDIDO ORIGINAL (ainda pendente): "${pending.pendingRequest}"`,
      '',
      'REGRAS:',
      '- Prossiga com o PEDIDO ORIGINAL usando a resposta acima. NAO cumprimente.',
      '- NAO se apresente, NAO pergunte "como posso ajudar" e NAO repita a pergunta ja respondida.',
      '- Se ainda faltar informacao essencial, pergunte APENAS o que falta.'
    );
  } else {
    lines.push(
      '',
      'REGRAS:',
      '- Use a resposta acima para continuar de onde parou. NAO cumprimente e NAO se apresente.'
    );
  }

  return lines.join('\n');
}
