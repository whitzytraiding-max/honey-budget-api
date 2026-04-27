import { useState } from "react";

export function useConfirm() {
  const [confirmDialog, setConfirmDialog] = useState(null);

  function showConfirm(message) {
    return new Promise((resolve) => {
      setConfirmDialog({ message, resolve });
    });
  }

  function handleConfirmYes() {
    confirmDialog?.resolve(true);
    setConfirmDialog(null);
  }

  function handleConfirmNo() {
    confirmDialog?.resolve(false);
    setConfirmDialog(null);
  }

  return { confirmDialog, showConfirm, handleConfirmYes, handleConfirmNo };
}
