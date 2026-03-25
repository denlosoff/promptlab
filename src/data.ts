import { Category, Token } from './types';

export const categories: Category[] = [
  { id: "light", name: "Свет", icon: "Sun" },
  { id: "color", name: "Цвет/Палитра", icon: "Palette" },
  { id: "camera", name: "Камера/Ракурс", icon: "Camera" },
  { id: "materials", name: "Материалы", icon: "Box" },
  { id: "effects", name: "Эффекты", icon: "Sparkles" },
  { id: "medium", name: "Медиум/Рендер", icon: "Monitor" },

  // Light facets -> subcategories
  { id: "light_type", parentId: "light", name: "Тип" },
  { id: "light_quality", parentId: "light", name: "Качество" },
  { id: "light_direction", parentId: "light", name: "Направление" },
  { id: "light_contrast", parentId: "light", name: "Контраст" },
  { id: "light_effect", parentId: "light", name: "Эффект" },

  // Light facet values -> sub-subcategories
  { id: "lt_key", parentId: "light_type", name: "Key light" },
  { id: "lt_fill", parentId: "light_type", name: "Fill light" },
  { id: "lt_rim", parentId: "light_type", name: "Rim light" },
  { id: "lt_back", parentId: "light_type", name: "Backlight" },
  { id: "lq_soft", parentId: "light_quality", name: "Soft" },
  { id: "lq_hard", parentId: "light_quality", name: "Hard" },
  { id: "lq_diff", parentId: "light_quality", name: "Diffused" },
  { id: "ld_front", parentId: "light_direction", name: "Front" },
  { id: "ld_side", parentId: "light_direction", name: "Side" },
  { id: "ld_top", parentId: "light_direction", name: "Top" },
  { id: "lc_low", parentId: "light_contrast", name: "Low contrast" },
  { id: "lc_high", parentId: "light_contrast", name: "High contrast" },
  { id: "le_dappled", parentId: "light_effect", name: "Dappled" },
  { id: "le_godrays", parentId: "light_effect", name: "God rays" },

  // Color facets
  { id: "color_temp", parentId: "color", name: "Температура" },
  { id: "color_sat", parentId: "color", name: "Насыщенность" },
  { id: "color_harm", parentId: "color", name: "Гармония" },

  // Color values
  { id: "ct_warm", parentId: "color_temp", name: "Warm" },
  { id: "ct_cool", parentId: "color_temp", name: "Cool" },
  { id: "ct_neutral", parentId: "color_temp", name: "Neutral" },
  { id: "cs_muted", parentId: "color_sat", name: "Muted" },
  { id: "cs_vibrant", parentId: "color_sat", name: "Vibrant" },
  { id: "ch_mono", parentId: "color_harm", name: "Monochrome" },
  { id: "ch_comp", parentId: "color_harm", name: "Complementary" },

  // Camera facets
  { id: "camera_shot", parentId: "camera", name: "Крупность" },
  { id: "camera_angle", parentId: "camera", name: "Угол" },
  { id: "camera_lens", parentId: "camera", name: "Оптика" },
  { id: "camera_dof", parentId: "camera", name: "Глубина резкости" },

  // Camera values
  { id: "cs_close", parentId: "camera_shot", name: "Close-up" },
  { id: "cs_wide", parentId: "camera_shot", name: "Wide shot" },
  { id: "cs_medium", parentId: "camera_shot", name: "Medium shot" },
  { id: "ca_low", parentId: "camera_angle", name: "Low angle" },
  { id: "ca_high", parentId: "camera_angle", name: "High angle" },
  { id: "ca_overhead", parentId: "camera_angle", name: "Overhead" },
  { id: "cl_85mm", parentId: "camera_lens", name: "85mm" },
  { id: "cl_macro", parentId: "camera_lens", name: "Macro" },
  { id: "cd_shallow", parentId: "camera_dof", name: "Shallow DOF" },
  { id: "cd_deep", parentId: "camera_dof", name: "Deep DOF" },

  // Materials facets
  { id: "mat_type", parentId: "materials", name: "Тип" },
  { id: "mat_state", parentId: "materials", name: "Состояние" },
  { id: "mat_gloss", parentId: "materials", name: "Блеск" },

  // Materials values
  { id: "mt_metal", parentId: "mat_type", name: "Metal" },
  { id: "mt_glass", parentId: "mat_type", name: "Glass" },
  { id: "mt_wood", parentId: "mat_type", name: "Wood" },
  { id: "ms_clean", parentId: "mat_state", name: "Clean" },
  { id: "ms_worn", parentId: "mat_state", name: "Worn" },
  { id: "ms_rusted", parentId: "mat_state", name: "Rusted" },
  { id: "mg_matte", parentId: "mat_gloss", name: "Matte" },
  { id: "mg_glossy", parentId: "mat_gloss", name: "Glossy" },

  // Effects facets
  { id: "eff_optic", parentId: "effects", name: "Оптика" },
  { id: "eff_noise", parentId: "effects", name: "Шум" },
  { id: "eff_tone", parentId: "effects", name: "Тон" },

  // Effects values
  { id: "eo_bloom", parentId: "eff_optic", name: "Bloom" },
  { id: "eo_chromatic", parentId: "eff_optic", name: "Chromatic aberration" },
  { id: "en_grain", parentId: "eff_noise", name: "Film grain" },
  { id: "et_cinematic", parentId: "eff_tone", name: "Cinematic" },
  { id: "et_washed", parentId: "eff_tone", name: "Washed out" },

  // Medium facets
  { id: "med_type", parentId: "medium", name: "Тип" },
  { id: "med_engine", parentId: "medium", name: "Движок" },
  { id: "med_style", parentId: "medium", name: "Стиль" },

  // Medium values
  { id: "mdt_2d", parentId: "med_type", name: "2D" },
  { id: "mdt_3d", parentId: "med_type", name: "3D" },
  { id: "mdt_photo", parentId: "med_type", name: "Photo" },
  { id: "mde_octane", parentId: "med_engine", name: "Octane" },
  { id: "mde_unreal", parentId: "med_engine", name: "Unreal Engine" },
  { id: "mds_cell", parentId: "med_style", name: "Cell shading" },
  { id: "mds_photo", parentId: "med_style", name: "Photoreal" }
];

export const tokens: Token[] = [
  {
    id: "t1",
    name: "Soft key light",
    descriptionShort: "Мягкий основной свет, равномерно освещающий объект.",
    aliases: ["diffused light", "softbox"],
    categoryIds: ["light", "lt_key", "lq_soft"],
    examples: []
  },
  {
    id: "t2",
    name: "Rim light",
    descriptionShort: "Контурный свет, отделяющий объект от фона.",
    aliases: ["edge light", "backlight"],
    categoryIds: ["light", "lt_rim", "lq_hard", "lc_high"],
    examples: []
  },
  {
    id: "t3",
    name: "Warm palette",
    descriptionShort: "Теплые оттенки: красный, оранжевый, желтый.",
    aliases: ["warm colors", "autumn tones"],
    categoryIds: ["color", "ct_warm"],
    examples: []
  },
  {
    id: "t4",
    name: "Cinematic lighting",
    descriptionShort: "Драматичное освещение как в кино.",
    aliases: ["movie lighting", "dramatic light"],
    categoryIds: ["light", "effects", "lc_high", "et_cinematic"],
    examples: []
  },
  {
    id: "t5",
    name: "Close-up shot",
    descriptionShort: "Крупный план, фокус на деталях или лице.",
    aliases: ["macro", "detailed shot"],
    categoryIds: ["camera", "cs_close", "cd_shallow"],
    examples: []
  },
  {
    id: "t6",
    name: "Wide shot",
    descriptionShort: "Общий план, показывающий окружение.",
    aliases: ["establishing shot", "long shot"],
    categoryIds: ["camera", "cs_wide", "cd_deep"],
    examples: []
  },
  {
    id: "t7",
    name: "Volumetric light",
    descriptionShort: "Свет, видимый в воздухе (дымка, туман).",
    aliases: ["god rays", "light shafts"],
    categoryIds: ["light", "effects", "le_godrays"],
    examples: []
  },
  {
    id: "t8",
    name: "Brushed metal",
    descriptionShort: "Матовый металл с текстурой царапин.",
    aliases: ["scratched metal", "matte steel"],
    categoryIds: ["materials", "mt_metal", "ms_worn", "mg_matte"],
    examples: []
  },
  {
    id: "t9",
    name: "Film grain",
    descriptionShort: "Эффект зернистости как на старой пленке.",
    aliases: ["noise", "vintage film"],
    categoryIds: ["effects", "en_grain"],
    examples: []
  },
  {
    id: "t10",
    name: "Octane render",
    descriptionShort: "Стиль высококачественного 3D рендера.",
    aliases: ["3d render", "c4d"],
    categoryIds: ["medium", "mdt_3d", "mde_octane", "mds_photo"],
    examples: []
  },
  {
    id: "t11",
    name: "Dappled light",
    descriptionShort: "Пятнистый свет, проходящий сквозь листву.",
    aliases: ["leaf shadows", "broken light"],
    categoryIds: ["light", "le_dappled", "lq_soft"],
    examples: []
  },
  {
    id: "t12",
    name: "Muted colors",
    descriptionShort: "Приглушенные, ненасыщенные цвета.",
    aliases: ["desaturated", "pastel"],
    categoryIds: ["color", "cs_muted"],
    examples: []
  },
  {
    id: "t13",
    name: "Overhead shot",
    descriptionShort: "Съемка сверху вниз (вид птичьего полета).",
    aliases: ["top-down", "bird-eye view"],
    categoryIds: ["camera", "ca_overhead"],
    examples: []
  },
  {
    id: "t14",
    name: "Frosted glass",
    descriptionShort: "Матовое стекло, рассеивающее свет.",
    aliases: ["matte glass", "diffused glass"],
    categoryIds: ["materials", "mt_glass", "mg_matte"],
    examples: []
  },
  {
    id: "t15",
    name: "Chromatic aberration",
    descriptionShort: "Оптическое искажение с цветными контурами.",
    aliases: ["color fringing", "rgb split"],
    categoryIds: ["effects", "eo_chromatic"],
    examples: []
  }
];
