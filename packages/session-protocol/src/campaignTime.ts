export type CampaignTime = { day: number; minute: number; epochYear: number; seed: number }
export type CampaignWeather = "clear" | "cloudy" | "rain" | "storm" | "fog" | "wind"
export const DEFAULT_CAMPAIGN_TIME: CampaignTime = { day: 0, minute: 480, epochYear: 1492, seed: 741 }
export const HARPTOS_MONTHS = ["Hammer","Alturiak","Ches","Tarsakh","Mirtul","Kythorn","Flamerule","Eleasis","Eleint","Marpenoth","Uktar","Nightal"] as const
const FESTIVALS: Record<number,string> = {30:"Midwinter",121:"Greengrass",212:"Midsummer",274:"Highharvestide",365:"Feast of the Moon"}
export function faerunDate(day: number, epochYear = 1492) {
  // Non-leap Harptos year: 12 x 30 days plus 5 festivals.
  const yearLength = 365
  const year = epochYear + Math.floor(day / yearLength)
  const ordinal = ((day % yearLength) + yearLength) % yearLength
  const festival = FESTIVALS[ordinal]
  const festivalsBefore = Object.keys(FESTIVALS).filter(key => Number(key) < ordinal).length
  const ordinaryDay = ordinal - festivalsBefore
  const month = HARPTOS_MONTHS[Math.floor(ordinaryDay / 30)] ?? "Nightal"
  const dayOfMonth = ordinaryDay % 30 + 1
  return { year, month, dayOfMonth, tenday: Math.floor((dayOfMonth - 1) / 10) + 1, festival }
}
export function moonPhase(day: number) {
  // Selûne: ~30-day cycle; 8 visible phases across three tendays.
  const phase = ((day % 30) + 30) % 30
  return { index: Math.floor((phase / 30) * 8), illumination: (1 - Math.cos(2 * Math.PI * phase / 30)) / 2 }
}
export function campaignLight(time: CampaignTime, weather: CampaignWeather) {
  const hour = time.minute / 60
  if (hour >= 6 && hour < 7 || hour >= 18 && hour < 19) return "penumbra"
  if (hour >= 7 && hour < 18) return weather === "storm" || weather === "fog" ? "penumbra" : "daylight"
  return moonPhase(time.day).illumination >= 0.25 && weather !== "storm" && weather !== "cloudy" ? "moonlight" : "darkness"
}
export function campaignWeather(time: CampaignTime): CampaignWeather {
  // Deterministic for the whole day; never re-roll on reconnect.
  let n = (time.day + 100000) ^ time.seed
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d)
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b)
  const roll = (n ^ (n >>> 16)) >>> 0
  return (["clear","clear","clear","cloudy","cloudy","rain","rain","storm","fog","wind"] as CampaignWeather[])[roll % 10]
}
export function advanceCampaignTime(time: CampaignTime, minutes: number): CampaignTime {
  const total = time.day * 1440 + time.minute + minutes
  const day = Math.floor(total / 1440)
  return { ...time, day, minute: ((total % 1440) + 1440) % 1440 }
}
