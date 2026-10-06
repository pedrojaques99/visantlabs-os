// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropzone, matchesAccept } from '@/components/ui/Dropzone';

afterEach(cleanup);

const png = () => new File(['x'], 'a.png', { type: 'image/png' });
const pdf = () => new File(['x'], 'b.pdf', { type: 'application/pdf' });
const zoneOf = (text: string) => screen.getByText(text).closest('label')!;

describe('Dropzone', () => {
  it('is a real, labelled file input that receives keyboard focus', async () => {
    const user = userEvent.setup();
    render(h(Dropzone, { onFiles: () => {}, label: 'Upload images' }));
    const input = screen.getByLabelText('Upload images') as HTMLInputElement;
    expect(input.type).toBe('file');
    await user.tab();
    expect(document.activeElement).toBe(input);
  });

  it('Enter opens the picker', async () => {
    const user = userEvent.setup();
    render(h(Dropzone, { onFiles: () => {}, label: 'Upload' }));
    const input = screen.getByLabelText('Upload') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    input.focus();
    await user.keyboard('{Enter}');
    expect(click).toHaveBeenCalled();
  });

  it('picked files reach onFiles, filtered by accept', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onFiles = vi.fn();
    render(h(Dropzone, { onFiles, accept: 'image/*', multiple: true, label: 'Upload' }));
    await user.upload(screen.getByLabelText('Upload'), [png(), pdf()]);
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0].map((f: File) => f.name)).toEqual(['a.png']);
  });

  it('dropped files reach onFiles; single mode keeps the first', () => {
    const onFiles = vi.fn();
    render(h(Dropzone, { onFiles, label: 'Upload' }));
    fireEvent.drop(zoneOf('Upload'), { dataTransfer: { files: [png(), png()] } });
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0]).toHaveLength(1);
  });

  it('dropTarget=false leaves the drop to the parent shell', () => {
    const onFiles = vi.fn();
    const parentDrop = vi.fn();
    render(
      h('div', { onDrop: parentDrop }, h(Dropzone, { onFiles, label: 'Upload', dropTarget: false }))
    );
    fireEvent.drop(zoneOf('Upload'), { dataTransfer: { files: [png()] } });
    expect(onFiles).not.toHaveBeenCalled();
    expect(parentDrop).toHaveBeenCalled();
  });

  it('disabled ignores drops', () => {
    const onFiles = vi.fn();
    render(h(Dropzone, { onFiles, label: 'Upload', disabled: true }));
    fireEvent.drop(zoneOf('Upload'), { dataTransfer: { files: [png()] } });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('matchesAccept handles mime, wildcard and extension rules', () => {
    expect(matchesAccept(png(), 'image/*')).toBe(true);
    expect(matchesAccept(png(), '.png')).toBe(true);
    expect(matchesAccept(png(), 'image/jpeg, .svg')).toBe(false);
    expect(matchesAccept(pdf(), undefined)).toBe(true);
  });
});
