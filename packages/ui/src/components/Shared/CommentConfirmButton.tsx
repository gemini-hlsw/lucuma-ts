import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { Button, type ButtonProps } from 'primereact/button';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { InputTextarea } from 'primereact/inputtextarea';
import type { IconType } from 'primereact/utils';
import { type ReactNode, useId, useRef, useState } from 'react';

import { Title } from './Title/Title';

/**
 * Button with confirmation popup including comment input. When clicked, shows a popup asking for confirmation to save along with an input field for a comment.
 */
export function CommentConfirmButton({
  className,
  disabled,
  icon,
  label,
  commentLabel,
  initialComment,
  loading,
  message,
  tooltip,
  confirmLabel = 'Save',
  rejectLabel = 'Cancel',
  onConfirm,
}: {
  className?: string;
  disabled?: boolean;
  icon?: IconType<ButtonProps>;
  label?: string;
  commentLabel?: string;
  initialComment?: string;
  loading?: boolean;
  message: string;
  tooltip?: string;
  confirmLabel?: string;
  rejectLabel?: string;
  onConfirm: (comment: string | null) => void | Promise<void>;
}) {
  const confirmButtonRef = useRef<Button>(null);
  const id = useId();

  return (
    <>
      <Button
        ref={confirmButtonRef}
        className="comment-confirm-button"
        tooltip={tooltip}
        aria-label={tooltip}
        disabled={disabled}
        loading={loading}
        label={label}
        icon={icon}
        onClick={() =>
          confirmPopup({
            // @ts-expect-error group is not typed in primereact types
            group: `comment-confirm-${id}`,
            message: message,
            target: confirmButtonRef.current as unknown as HTMLElement,
          })
        }
      />
      <ConfirmPopup
        // @ts-expect-error group is not typed in primereact types
        group={`comment-confirm-${id}`}
        // eslint-disable-next-line @typescript-eslint/unbound-method
        content={({ hide, acceptBtnRef, rejectBtnRef, message }) => (
          <CommentConfirmPopup
            className={className}
            message={message}
            loading={loading}
            confirmLabel={confirmLabel}
            commentLabel={commentLabel}
            initialComment={initialComment}
            rejectLabel={rejectLabel}
            acceptBtnRef={acceptBtnRef}
            rejectBtnRef={rejectBtnRef}
            onConfirm={onConfirm}
            onHide={() => hide()}
          />
        )}
      />
    </>
  );
}

function CommentConfirmPopup({
  className,
  message,
  loading,
  confirmLabel,
  commentLabel,
  initialComment,
  rejectLabel,
  acceptBtnRef,
  rejectBtnRef,
  onConfirm,
  onHide,
}: {
  className?: string;
  message: ReactNode;
  loading: boolean | undefined;
  confirmLabel: string;
  commentLabel?: string;
  initialComment?: string;
  rejectLabel: string;
  acceptBtnRef: React.Ref<HTMLButtonElement>;
  rejectBtnRef: React.Ref<HTMLButtonElement>;
  onConfirm: (comment: string | null) => void | Promise<void>;
  onHide: () => void;
}) {
  const [comment, setComment] = useState(initialComment ?? '');

  const rows = Math.max((comment.match(/\n/g)?.length ?? 0) + 2, 6);

  return (
    <div className={cn(className, 'confirm-button-popup')}>
      <Title title={message} />
      {commentLabel && (
        <label className="confirm-button-comment-label" htmlFor="comment-confirm-textarea">
          {commentLabel}
        </label>
      )}
      <InputTextarea
        id="comment-confirm-textarea"
        placeholder="Enter a comment (optional)"
        value={comment}
        cols={60}
        rows={rows}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="confirm-button-buttons modal-footer">
        <Button severity="danger" text label={rejectLabel} onClick={onHide} ref={rejectBtnRef as React.Ref<Button>} />
        <Button
          label={confirmLabel}
          loading={loading}
          onClick={async () => {
            await onConfirm(comment.trim() || null);
            onHide();
          }}
          ref={acceptBtnRef as React.Ref<Button>}
        />
      </div>
    </div>
  );
}
