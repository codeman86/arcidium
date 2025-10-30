import type { ArticleMeta } from "./articles";

export type TaxonomyTag = {
  name: string;
  slug: string;
  count: number;
};

export type TaxonomySubcategory = {
  name: string;
  slug: string;
  count: number;
  tags: TaxonomyTag[];
};

export type TaxonomyCategory = {
  name: string;
  slug: string;
  count: number;
  tags: TaxonomyTag[];
  subcategories: TaxonomySubcategory[];
};

type MutableCategory = TaxonomyCategory & {
  tagMap: Map<string, TaxonomyTag>;
  subcategoryMap: Map<
    string,
    TaxonomySubcategory & { tagMap: Map<string, TaxonomyTag> }
  >;
};

export function buildTaxonomy(articles: ArticleMeta[]): TaxonomyCategory[] {
  const categoryMap = new Map<string, MutableCategory>();

  for (const article of articles) {
    const categoryName = article.category ?? "Uncategorized";
    const categorySlug = slugify(categoryName);

    const category =
      categoryMap.get(categorySlug) ??
      createCategory(categoryName, categorySlug, categoryMap);

    category.count += 1;

    if (article.tags.length > 0) {
      for (const tag of article.tags) {
        upsertTag(category.tagMap, tag);
      }
    }

    if (article.subcategory) {
      const subcategorySlug = slugify(article.subcategory);
      const subcategory =
        category.subcategoryMap.get(subcategorySlug) ??
        createSubcategory(article.subcategory, subcategorySlug, category);

      subcategory.count += 1;

      if (article.tags.length > 0) {
        for (const tag of article.tags) {
          upsertTag(subcategory.tagMap, tag);
        }
      }
    }
  }

  return Array.from(categoryMap.values())
    .map<TaxonomyCategory>((category) => ({
      name: category.name,
      slug: category.slug,
      count: category.count,
      tags: mapToSortedArray(category.tagMap),
      subcategories: Array.from(category.subcategoryMap.values())
        .map<TaxonomySubcategory>((subcategory) => ({
          name: subcategory.name,
          slug: subcategory.slug,
          count: subcategory.count,
          tags: mapToSortedArray(subcategory.tagMap),
        }))
        .sort(byName),
    }))
    .sort(byName);
}

function createCategory(
  name: string,
  slug: string,
  categoryMap: Map<string, MutableCategory>
) {
  const category: MutableCategory = {
    name,
    slug,
    count: 0,
    tags: [],
    subcategories: [],
    tagMap: new Map(),
    subcategoryMap: new Map(),
  };
  categoryMap.set(slug, category);
  return category;
}

function createSubcategory(
  name: string,
  slug: string,
  category: MutableCategory
) {
  const subcategory: TaxonomySubcategory & { tagMap: Map<string, TaxonomyTag> } =
    {
      name,
      slug,
      count: 0,
      tags: [],
      tagMap: new Map(),
    };
  category.subcategoryMap.set(slug, subcategory);
  return subcategory;
}

function upsertTag(map: Map<string, TaxonomyTag>, name: string) {
  const slug = slugify(name);
  const existing = map.get(slug);
  if (existing) {
    existing.count += 1;
    return existing;
  }

  const tag: TaxonomyTag = {
    name,
    slug,
    count: 1,
  };
  map.set(slug, tag);
  return tag;
}

function mapToSortedArray(map: Map<string, TaxonomyTag>) {
  return Array.from(map.values()).sort(byCountThenName);
}

function byName<T extends { name: string }>(a: T, b: T) {
  return a.name.localeCompare(b.name);
}

function byCountThenName<T extends { count: number; name: string }>(
  a: T,
  b: T
) {
  if (a.count === b.count) {
    return a.name.localeCompare(b.name);
  }
  return b.count - a.count;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
