import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
export default function ManagerDialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close() }, [])
  return <dialog ref={ref} className="manager-dialog" aria-labelledby="manager-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="manager-dialog-head"><h2 id="manager-dialog-title">{title}</h2><button type="button" className="manager-button" aria-label="Đóng cửa sổ" onClick={onClose} disabled={busy}><X size={17} /></button></header>{children}
  </dialog>
}
