import { useState } from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"

export type CreatedSpell = {
  id: string
  name: string
  level: number
  school: string
  castingTime: string
  range: string
  components: string
  duration: string
  concentration: boolean
  ritual: boolean
  description: string
  higherLevel: string
}

function newSpell(): CreatedSpell {
  return {
    id: crypto.randomUUID(),
    name: "",
    level: 0,
    school: "",
    castingTime: "1 ação",
    range: "",
    components: "",
    duration: "",
    concentration: false,
    ritual: false,
    description: "",
    higherLevel: "",
  }
}

export function SpellCreatorModule() {
  const [spell, setSpell] = useState<CreatedSpell>(() => newSpell())

  function updateSpell<K extends keyof CreatedSpell>(
    key: K,
    value: CreatedSpell[K],
  ) {
    setSpell((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">
          Criar magia
        </div>
        <div className="mt-1 text-xs text-text">
          Crie uma magia homebrew para usar na mesa.
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3">
          <Input
            value={spell.name}
            onChange={(e) => updateSpell("name", e.target.value)}
            placeholder="Nome da magia"
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text">
              Nível
              <Input
                type="number"
                min={0}
                max={9}
                value={spell.level}
                onChange={(e) =>
                  updateSpell("level", Number(e.target.value))
                }
              />
            </label>

            <label className="text-xs text-text">
              Escola
              <Input
                value={spell.school}
                onChange={(e) => updateSpell("school", e.target.value)}
                placeholder="Evocação, Necromancia..."
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              value={spell.castingTime}
              onChange={(e) => updateSpell("castingTime", e.target.value)}
              placeholder="Tempo de conjuração"
            />

            <Input
              value={spell.range}
              onChange={(e) => updateSpell("range", e.target.value)}
              placeholder="Alcance"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              value={spell.components}
              onChange={(e) => updateSpell("components", e.target.value)}
              placeholder="Componentes: V, S, M"
            />

            <Input
              value={spell.duration}
              onChange={(e) => updateSpell("duration", e.target.value)}
              placeholder="Duração"
            />
          </div>

          <div className="flex gap-4 text-xs text-text">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={spell.concentration}
                onChange={(e) =>
                  updateSpell("concentration", e.target.checked)
                }
              />
              Concentração
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={spell.ritual}
                onChange={(e) => updateSpell("ritual", e.target.checked)}
              />
              Ritual
            </label>
          </div>

          <textarea
            className="min-h-32 rounded-xl border border-accentBorder bg-bg px-3 py-2 text-sm text-text outline-none transition-colors focus:border-accent"
            value={spell.description}
            onChange={(e) => updateSpell("description", e.target.value)}
            placeholder="Descrição da magia"
          />

          <textarea
            className="min-h-24 rounded-xl border border-accentBorder bg-bg px-3 py-2 text-sm text-text outline-none transition-colors focus:border-accent"
            value={spell.higherLevel}
            onChange={(e) => updateSpell("higherLevel", e.target.value)}
            placeholder="Em níveis superiores"
          />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSpell(newSpell())}>
              Limpar
            </Button>

            <Button variant="primary" onClick={() => console.log(spell)}>
              Salvar magia
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}