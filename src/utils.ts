const CHARACTERS = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890'
const SLUG_LENGTH = 6

export function generateSlug() {
  return Array.from({ length: SLUG_LENGTH }).map(() =>
    CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length))
  ).join('')
}
