import { handleCharacterDomain } from '../_lib/characterDomainApi'

export default function handler(...args: Parameters<typeof handleCharacterDomain>) {
  return handleCharacterDomain(args[0], args[1], 'equipment')
}
