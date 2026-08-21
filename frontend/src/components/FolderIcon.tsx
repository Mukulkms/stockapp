// Folder icon jo reference image jaisa lagta hai — tab + body, thick outline,
// andar ek "paper peeking out" detail. Color accent prop se controlled hota hai
// taaki har company/group ka apna consistent color rahe.
export default function FolderIcon({ color, size = 40, open = false }: { color: string; size?: number; open?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* back flap — slightly darker, peeks out to the right like the reference art */}
      <path
        d="M6 14a3 3 0 0 1 3-3h6l3 3.5h21a3 3 0 0 1 3 3V17H6v-3z"
        fill={color}
        opacity={0.55}
      />
      {/* paper peeking out of the folder */}
      {open && (
        <rect x="10" y="15" width="24" height="10" rx="1.2" fill="#ffffff" opacity={0.92} />
      )}
      {/* front folder body */}
      <path
        d="M6 17a2 2 0 0 1 2-2h9l3-3.2h15a2 2 0 0 1 2 2V19H6v-2z"
        fill={color}
      />
      <rect x="4" y="19" width="40" height="22" rx="3" fill={color} />
      <rect x="4" y="19" width="40" height="22" rx="3" fill="#ffffff" opacity={open ? 0.14 : 0} />
    </svg>
  )
}
