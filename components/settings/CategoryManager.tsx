"use client";

import { useState } from "react";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { uid } from "@/lib/ids";
import type { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** The store's product categories: add, rename or delete. The product form lets people pick from this list. */
export function CategoryManager() {
  const { activeTenant, products } = usePos();
  const { categories, saveCategory, deleteCategory } = useOps();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  if (!activeTenant) return null;

  const mine = products.filter((p) => p.tenantId === activeTenant.id);
  const uses = (category: string) => mine.filter((p) => p.category === category).length;
  const taken = (value: string, exceptId?: string) =>
    categories.some((c) => c.id !== exceptId && c.name.toLowerCase() === value.trim().toLowerCase());
  // Categories on existing products that aren't in the list yet (products added before this list existed).
  const unlisted = [...new Set(mine.map((p) => p.category).filter(Boolean))].filter((c) => !taken(c)).sort();

  /** Returns true when the category was added. */
  const add = (value: string) => {
    const clean = value.trim();
    const problem = !clean
      ? "Enter a category name."
      : clean.length > 40
        ? "A category name must be 40 characters or fewer."
        : taken(clean)
          ? `You already have a category called ${clean}.`
          : "";
    setError(problem);
    if (problem) return false;
    saveCategory({ id: uid("cat"), tenantId: activeTenant.id, name: clean, createdAt: new Date().toISOString() });
    return true;
  };

  const rename = (category: Category) => {
    const clean = draft.trim();
    if (!clean) return setError("Enter a category name.");
    if (clean.length > 40) return setError("A category name must be 40 characters or fewer.");
    if (taken(clean, category.id)) return setError(`You already have a category called ${clean}.`);
    setError("");
    setEditingId(null);
    if (clean !== category.name) saveCategory({ ...category, name: clean });
  };

  const remove = (category: Category) => {
    const count = uses(category.name);
    const message = count
      ? `Delete ${category.name}? ${count} ${count === 1 ? "product keeps" : "products keep"} the name, but it won't be offered for new products.`
      : `Delete ${category.name}?`;
    if (window.confirm(message)) deleteCategory(category.id);
  };

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (add(name)) setName("");
        }}
        noValidate
      >
        <Input
          aria-label="New category name"
          placeholder="New category, like Drinks"
          value={name}
          onChange={(event) => {
            setError("");
            setName(event.target.value);
          }}
        />
        <Button type="submit">Add</Button>
      </form>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet. Add the ones you sell under and they will show up in the product form.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center gap-2 p-2">
              {editingId === category.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    rename(category);
                  }}
                  noValidate
                >
                  <Input aria-label={`Rename ${category.name}`} autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} />
                  <Button type="submit" size="sm">Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingId(null); setError(""); }}>Cancel</Button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{category.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{uses(category.name)} {uses(category.name) === 1 ? "product" : "products"}</span>
                  <Button size="sm" variant="secondary" onClick={() => { setEditingId(category.id); setDraft(category.name); setError(""); }}>Rename</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(category)}>Delete</Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {unlisted.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Already on your products but not in the list. Add them to pick them from the form:</p>
          <div className="flex flex-wrap gap-2">
            {unlisted.map((category) => (
              <Button key={category} size="sm" variant="secondary" onClick={() => add(category)}>
                + {category}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
