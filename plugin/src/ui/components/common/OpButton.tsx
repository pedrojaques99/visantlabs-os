import React from 'react';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { OpRunner } from '../../hooks/useOpRunner';

export interface OpButtonProps extends Omit<React.ComponentProps<typeof Button>, 'onClick' | 'disabled'> {
  /** Unique id for this op. Used to track busy state. */
  opId: string;
  /** Runner instance from useOpRunner(). */
  runner: OpRunner;
  /** Message sent to sandbox, or null if using `task`. */
  message?: any;
  /** Response types that resolve the op. */
  responseTypes?: string[];
  /** Async task alternative to sandbox message. */
  task?: () => Promise<any>;
  /** Label shown while idle. */
  children: React.ReactNode;
  /** Label shown while busy. Defaults to "{children}…". */
  busyLabel?: React.ReactNode;
  /** Leading icon (hidden while busy — replaced by spinner). */
  icon?: React.ReactNode;
  /** Force disabled regardless of busy state. */
  disabled?: boolean;
  /** If true, block while any op runs. Default true. */
  blockOnAnyBusy?: boolean;
}

/**
 * Drop-in Button with automatic loading state.
 *
 *   <OpButton opId="lint" runner={runner}
 *             message={{ type: 'BRAND_LINT' }}
 *             responseTypes={['BRAND_LINT_REPORT']}
 *             icon={<Zap size={14} />}>Lint</OpButton>
 */
export function OpButton({
  opId,
  runner,
  message,
  responseTypes,
  task,
  children,
  busyLabel,
  icon,
  disabled,
  blockOnAnyBusy = true,
  ...rest
}: OpButtonProps) {
  const busy = runner.isBusy(opId);
  const locked = disabled || (blockOnAnyBusy ? runner.anyBusy : busy);

  const onClick = () => {
    runner.run(opId, message ?? null, { responseTypes, task });
  };

  return (
    <Button {...rest} disabled={locked} onClick={onClick}>
      {busy ? <GlitchLoader size={14} className="mr-2" /> : icon ? <span className="mr-2 inline-flex">{icon}</span> : null}
      {busy ? busyLabel ?? <>{children}…</> : children}
    </Button>
  );
}
