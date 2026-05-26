import { getUserTags } from "@/app/actions/settings";
import NewMaterialForm from "@/app/ui/projects/NewMaterialForm";

const DEFAULT_CATEGORIES = [
  { value: "profilo", label: "Profilo L/C/U" },
  { value: "lastra", label: "Lastra C.S." },
  { value: "accessorio", label: "Accessorio (Guarnizioni/Viti)" },
];

const DEFAULT_UNITS = [
  { value: "pz", label: "Pezzi (pz)" },
  { value: "ml", label: "Metri Lineari (ml)" },
  { value: "mq", label: "Metri Quadri (mq)" },
];

export default async function NewMaterialPage() {
  const [categoryTags, unitTags] = await Promise.all([
    getUserTags("material_category"),
    getUserTags("material_unit"),
  ]);

  const categories = categoryTags.length > 0
    ? categoryTags.map((tag) => ({ value: tag.name, label: tag.name }))
    : DEFAULT_CATEGORIES;

  const units = unitTags.length > 0
    ? unitTags.map((tag) => ({ value: tag.name, label: tag.name }))
    : DEFAULT_UNITS;

  return <NewMaterialForm categories={categories} units={units} />;
}
