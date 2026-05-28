import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Textarea } from '../../components/ui/Textarea'

type Props = {
  characterName: string
  notes: string
  canEdit: boolean
  onChange: (value: string) => void
}

export function CampaignNotesPanel({ characterName, notes, canEdit, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">Anotações de {characterName}</div>
        <div className="mt-1 text-xs text-text">Registro livre por personagem: ganchos, objetivos, pistas e lembretes.</div>
      </CardHeader>
      <CardContent>
        <Textarea
          rows={14}
          value={notes}
          disabled={!canEdit}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escreva as anotações da campanha aqui..."
        />
      </CardContent>
    </Card>
  )
}