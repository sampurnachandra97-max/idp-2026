import { Apple, Banana, Bean, Citrus, Coffee, Grape, Sprout, TreePalm, Wheat, type LucideIcon } from "lucide-react";
import { CUSTOM_CROP_ICONS } from "@/lib/cropIcons";

const LIBRARY_ICONS: Record<string, LucideIcon> = {
  rice: Wheat,
  chickpea: Bean,
  kidneybeans: Bean,
  pigeonpeas: Bean,
  mothbeans: Bean,
  mungbean: Bean,
  blackgram: Bean,
  lentil: Bean,
  banana: Banana,
  grapes: Grape,
  apple: Apple,
  orange: Citrus,
  coconut: TreePalm,
  coffee: Coffee,
};

const SIZE = 18;
const STROKE = 1.75;

export function CropIcon({ crop }: { crop: string }) {
  const custom = CUSTOM_CROP_ICONS[crop];
  if (custom) {
    return (
      <svg
        width={SIZE}
        height={SIZE}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {custom.map((d) => <path key={d} d={d} />)}
      </svg>
    );
  }
  const Icon = LIBRARY_ICONS[crop] ?? Sprout;
  return <Icon size={SIZE} strokeWidth={STROKE} aria-hidden="true" />;
}
