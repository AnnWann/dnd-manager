
export function TopBar() {
  return (
    <header className="border-b border-accentBorder bg-accentBg">
      <div className="flex w-full flex-col gap-3 px-4 py-3">
        <h1 className="font-heading text-xl text-textH">
          Gerenciador de Magias (D&amp;D)
        </h1>
        <p className="text-xs text-text">Sync • Ficha • Magia</p>
      </div>
    </header>
  )
}