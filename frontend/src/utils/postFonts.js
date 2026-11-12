export const POST_FONTS = [
  {
    id: "montserrat",
    label: "Montserrat",
    family: '"Montserrat", system-ui, sans-serif',
  },
  {
    id: "poppins",
    label: "Poppins",
    family: '"Poppins", "Montserrat", sans-serif',
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    family: '"DM Sans", "Montserrat", sans-serif',
  },
  {
    id: "nunito",
    label: "Nunito",
    family: '"Nunito", "Montserrat", sans-serif',
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    family: '"Space Grotesk", "Montserrat", sans-serif',
  },
  {
    id: "lora",
    label: "Lora",
    family: '"Lora", Georgia, serif',
  },
  {
    id: "merriweather",
    label: "Merriweather",
    family: '"Merriweather", Georgia, serif',
  },
  {
    id: "playfair",
    label: "Playfair Display",
    family: '"Playfair Display", Georgia, serif',
  },
  {
    id: "roboto-slab",
    label: "Roboto Slab",
    family: '"Roboto Slab", Georgia, serif',
  },
  {
    id: "montserrat-alt",
    label: "Montserrat Alternates",
    family: '"Montserrat Alternates", "Montserrat", sans-serif',
  },
];

export const DEFAULT_POST_FONT = POST_FONTS[0].id;

export function getPostFont(id) {
  return POST_FONTS.find((font) => font.id === id) || POST_FONTS[0];
}

export function postFontStyle(id) {
  return { fontFamily: getPostFont(id).family };
}
