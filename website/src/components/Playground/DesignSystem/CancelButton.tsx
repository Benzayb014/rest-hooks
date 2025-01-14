import React from 'react';

export function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <span style={{ cursor: 'pointer', marginLeft: '.5em' }} onClick={onClick}>
      <img
        src="/img/cancel.png"
        width="16"
        height="16"
        style={{ marginBottom: '-3px' }}
      />
    </span>
  );
}
