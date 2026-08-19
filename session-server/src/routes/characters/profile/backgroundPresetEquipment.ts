import type { Itemmable } from "../../../../../src/models/items/item";

const BACKGROUND_EQUIPMENT: Record<string, string[]> = {
  acolyte: ["Símbolo sagrado", "Livro de orações", "Incenso", "Vestes", "Roupas comuns"],
  charlatan: ["Roupas finas", "Kit de disfarce", "Ferramentas de golpe"],
  criminal: ["Pé de cabra", "Roupas escuras", "Bolsa"],
  entertainer: ["Instrumento musical", "Presente de admirador", "Traje"],
  "folk-hero": ["Ferramenta de artesão", "Pá", "Panela de ferro", "Roupas comuns"],
  "guild-artisan": ["Ferramenta de artesão", "Carta de apresentação", "Roupas de viajante"],
  hermit: ["Estojo de pergaminhos", "Cobertor", "Kit de herbalismo", "Roupas comuns"],
  noble: ["Roupas finas", "Anel de sinete", "Pergaminho de linhagem"],
  outlander: ["Cajado", "Armadilha de caça", "Troféu animal", "Roupas de viajante"],
  sage: ["Frasco de tinta", "Pena", "Pequena faca", "Carta de colega", "Roupas comuns"],
  sailor: ["Cavilha de amarração", "Corda de seda", "Amuleto da sorte", "Roupas comuns"],
  soldier: ["Insígnia de patente", "Troféu de inimigo", "Conjunto de jogo", "Roupas comuns"],
  urchin: ["Pequena faca", "Mapa da cidade", "Mascote pequeno", "Lembrança familiar", "Roupas comuns"],
};

export function getBackgroundPresetStartingEquipment(backgroundId: string): Itemmable[] | null {
  const names = BACKGROUND_EQUIPMENT[backgroundId];
  if (!names) return null;

  return names.map((name, index) => ({
    id: `background-preset:${backgroundId}:${index}`,
    name,
    desc: "Equipamento inicial concedido pelo antecedente.",
    notes: "",
    quantity: 1,
    weight: 0,
    pocketable: false,
    kind: "common",
  }));
}
