import type { Metamagic, MetamagicId } from "../../../models/magic/metamagic/Metamagic"
import { Button } from "../../../components/ui/Button"

type Props = {
  open: boolean
  metamagics: Metamagic[]
  knownMetamagicIds: MetamagicId[]
  onAdd: (id: MetamagicId) => void
  onClose: () => void
}

export function MetamagicSelector({
  open,
  metamagics,
  knownMetamagicIds,
  onAdd,
  onClose,
}: Props) {
  if (!open) return null

  const availableMetamagics = metamagics.filter(
    (metamagic) => !knownMetamagicIds.includes(metamagic.id),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-bg shadow-xl">
        <div className="flex items-center justify-between border-b border-accentBorder p-4">
          <div>
            <h2 className="font-heading text-lg text-textH">
              Adicionar metamagia
            </h2>
            <p className="mt-1 text-xs text-text">
              Escolha uma metamagia para adicionar ao personagem.
            </p>
          </div>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="grid gap-3 p-4">
          {availableMetamagics.length === 0 ? (
            <div className="rounded-xl border border-accentBorder bg-bg px-3 py-4 text-sm text-text">
              Nenhuma metamagia disponível.
            </div>
          ) : (
            availableMetamagics.map((metamagic) => (
              <div
                key={metamagic.id}
                className="rounded-xl border border-accentBorder bg-bg p-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-textH">
                      {metamagic.name}
                    </div>

                    <div className="mt-1 text-xs text-text">
                      Custo: {formatCost(metamagic.sorceryPointCost)} •{" "}
                      {formatTiming(metamagic.timing)}
                    </div>

                    <div className="mt-2 grid gap-1 text-xs leading-5 text-text">
                      {metamagic.desc.map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onAdd(metamagic.id)}
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function formatCost(cost: Metamagic["sorceryPointCost"]) {
  if (cost === "spell-level") return "nível da magia"
  return `${cost} ponto${cost === 1 ? "" : "s"}`
}

function formatTiming(timing: Metamagic["timing"]) {
  switch (timing) {
    case "on-cast":
      return "ao conjurar"
    case "on-damage-roll":
      return "ao rolar dano"
    case "on-miss":
      return "ao errar"
    default:
      return timing
  }
}