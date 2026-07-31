import { useState } from "react"
import { Copy, PackageOpen, Plus } from "lucide-react"

import { Button } from "../components/ui/Button"
import { Card, CardContent, CardHeader } from "../components/ui/Card"
import { Textarea } from "../components/ui/Textarea"
import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import { InventoryEditor } from "../features/characters/inventory/inventoryEditor"
import { TransferItemDialog } from "../features/characters/inventory/transferItemDialog"
import {
  itemJsonTemplate,
  parseItemJson,
} from "../features/items/itemJsonGuide"
import type { Itemmable } from "../models/items/item"

export function GroundInventoryView() {
  const { userRole } = useSyncContext()
  const {
    groundInventory,
    transferCharacters,
    canViewCharacterDetails,
    addGroundItem,
    updateGroundItem,
    removeGroundItem,
    transferItem,
  } = useCharacterContext()
  const [transferringItem, setTransferringItem] = useState<Itemmable | null>(null)
  const [jsonValue, setJsonValue] = useState("")
  const [jsonMessage, setJsonMessage] = useState("")
  const canManage = userRole === "master"

  async function copyStructure() {
    const template = JSON.stringify(buildItemAiGuide(), null, 2)
    await navigator.clipboard.writeText(template)
    setJsonValue(template)
    setJsonMessage("Guia completo copiado.")
  }

  function addFromJson() {
    try {
      addGroundItem(parseItemJson(jsonValue))
      setJsonValue("")
      setJsonMessage("Item adicionado ao chão.")
    } catch (error) {
      setJsonMessage(error instanceof Error ? error.message : "JSON inválido.")
    }
  }

  return (
    <div className="grid w-full min-w-0 max-w-full gap-4 overflow-hidden">
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-textH">
            <PackageOpen className="h-4 w-4 shrink-0 text-accent" />
            <span className="break-words">Chão</span>
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-textMuted">
            Itens largados por personagens ficam disponíveis aqui para todo o grupo.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <Summary label="Itens diferentes" value={groundInventory.length} />
            <Summary
              label="Quantidade total"
              value={groundInventory.reduce(
                (total, item) => total + Math.max(0, item.quantity ?? 0),
                0,
              )}
            />
          </div>
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-textH">Adicionar item via JSON</h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Cole somente o objeto do item ou o guia completo para IA. Quando o
              envelope completo for usado, apenas o conteúdo do campo `item` será
              importado.
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              className="min-h-72 font-mono text-xs"
              value={jsonValue}
              placeholder="Cole o JSON do item ou o guia preenchido por uma IA"
              onChange={(event) => {
                setJsonValue(event.target.value)
                setJsonMessage("")
              }}
            />
            <p className="mt-2 text-[11px] leading-5 text-textMuted">
              O guia inclui campos válidos, enums e exemplos de armas, armaduras,
              consumíveis com efeitos, itens arremessáveis, suprimentos, focos com
              magias e moedas.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                disabled={!jsonValue.trim()}
                onClick={addFromJson}
              >
                <Plus className="h-4 w-4" />
                Adicionar ao chão
              </Button>
              <Button size="sm" variant="secondary" onClick={copyStructure}>
                <Copy className="h-4 w-4" />
                Copiar guia completo para IA
              </Button>
              {jsonMessage ? (
                <span className="text-xs text-textMuted">{jsonMessage}</span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <InventoryEditor
        title="Itens no chão"
        description="Este inventário não possui limite de peso ou capacidade."
        items={groundInventory}
        emptyMessage="Não há itens largados no chão."
        onAddItem={canManage ? addGroundItem : undefined}
        onUpdateItem={canManage ? updateGroundItem : undefined}
        onRemoveItem={canManage ? removeGroundItem : undefined}
        onTransferItem={setTransferringItem}
        transferLabel="Pegar ou transferir"
      />

      <TransferItemDialog
        open={transferringItem !== null}
        item={transferringItem}
        from={{ type: "ground" }}
        characters={transferCharacters}
        canViewCharacterDetails={canViewCharacterDetails}
        onClose={() => setTransferringItem(null)}
        onTransfer={transferItem}
      />
    </div>
  )
}

function buildItemAiGuide() {
  const guide = itemJsonTemplate()
  const consumableExample = guide.examples.consumable ?? {}

  return {
    ...guide,
    instructions: [
      ...guide.instructions,
      "Consumíveis com efeitos mecânicos devem usar `consumptionEffect`; `useText` sozinho é apenas texto descritivo e não altera a ficha.",
      "Em `consumptionEffect.persistence`, use `temporary` para criar uma condição removível ou `permanent` para incorporar os benefícios à ficha.",
      "Use um `consumptionEffect.id` estável e exclusivo. Consumir novamente um efeito com o mesmo ID atualiza o efeito existente em vez de criar duplicatas.",
      "Para efeitos temporários, informe `durationText` com a duração narrativa, como `1 minuto`, `8 horas` ou `até o próximo descanso longo`.",
      "Em `consumptionEffect.bonuses`, use a mesma estrutura descrita em `bonuses`; os bônus temporários permanecem enquanto a condição existir.",
      "Em `consumptionEffect.grantedSpells`, use `{index, castingMode, attribute?}`. Use `known` quando a magia deve usar espaços normais do personagem.",
      "Magias de efeitos temporários desaparecem quando a condição é removida. Magias de efeitos permanentes permanecem na ficha.",
      "Remova `consumptionEffect` quando o consumível possuir apenas um efeito narrativo ou manual que o sistema não precisa aplicar automaticamente.",
    ],
    enums: {
      ...guide.enums,
      consumableEffectPersistence: ["temporary", "permanent"],
    },
    fieldGuide: {
      ...guide.fieldGuide,
      consumptionEffect:
        "Objeto opcional usado somente por kind=consumable para aplicar benefícios automaticamente ao personagem quando uma unidade for consumida.",
      "consumptionEffect.id":
        "string recomendada, estável e exclusiva. Identifica o efeito para atualização e prevenção de duplicatas.",
      "consumptionEffect.name":
        "string exibida como nome da condição temporária ou característica permanente.",
      "consumptionEffect.description":
        "string com a explicação narrativa e mecânica dos benefícios concedidos.",
      "consumptionEffect.persistence":
        "obrigatório: temporary cria uma condição removível; permanent incorpora os benefícios à ficha.",
      "consumptionEffect.durationText":
        "string recomendada para temporary. Descreve a duração, por exemplo `1 hora`, `10 minutos` ou `até o próximo descanso longo`.",
      "consumptionEffect.bonuses":
        "BonusCollection opcional com a mesma estrutura do campo bonuses. Pode afetar CA, iniciativa, HP, ataques, dano, CDs, velocidade e atributos.",
      "consumptionEffect.grantedSpells":
        "lista opcional de {index, castingMode?, attribute?}. Use castingMode=known para conceder a magia usando espaços normais; index deve existir no catálogo.",
    },
    examples: {
      ...guide.examples,
      consumable: {
        ...consumableExample,
        name: "Elixir da força arcana",
        desc: "Concede força sobrenatural e acesso temporário à magia Salto.",
        useText: "Beba o elixir para receber seus efeitos.",
        consumptionEffect: {
          id: "elixir-forca-arcana-effect",
          name: "Força arcana",
          description: "O corpo do personagem é fortalecido magicamente.",
          persistence: "temporary",
          durationText: "1 hora",
          bonuses: {
            attribute: [
              {
                attribute: "str",
                bonus: {
                  type: "flat",
                  value: 21,
                  label: "Elixir da força arcana",
                },
              },
            ],
          },
          grantedSpells: [
            {
              index: "jump",
              castingMode: "known",
              attribute: "int",
            },
          ],
        },
      },
      permanentConsumable: {
        id: "",
        name: "Tomo da visão interior",
        desc: "Consumível raro que altera permanentemente a percepção do leitor.",
        notes: "",
        quantity: 1,
        weight: 1,
        pocketable: true,
        kind: "consumable",
        magicItem: true,
        requiresAttunement: false,
        attuned: false,
        insideBagOfHolding: false,
        useText: "Leia e absorva o conhecimento do tomo.",
        consumptionEffect: {
          id: "tomo-visao-interior-effect",
          name: "Visão interior",
          description: "O conhecimento do tomo permanece incorporado ao personagem.",
          persistence: "permanent",
          bonuses: {
            passivePerception: [
              {
                type: "add",
                value: 1,
                label: "Tomo da visão interior",
              },
            ],
          },
          grantedSpells: [
            {
              index: "detect-magic",
              castingMode: "known",
              attribute: "wis",
            },
          ],
        },
      },
    },
  }
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-textH">{value}</div>
    </div>
  )
}
