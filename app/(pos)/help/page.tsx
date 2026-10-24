"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { SearchBox, matches } from "@/components/data-table/controls";
import { canOpen } from "@/components/layout/Sidebar";
import { useAuth } from "@/contexts/auth-context";

interface Article {
  q: string;
  a: string;
  /** Page the answer is about. */
  href?: string;
}

const TOPICS: { title: string; articles: Article[] }[] = [
  {
    title: "Getting started",
    articles: [
      { q: "How do I set up my store?", a: "After you create an account, enter your store's name, business type and currency. You can add more stores later in Settings and switch between them at any time.", href: "/settings" },
      { q: "How do I add my first products?", a: "Open Inventory and press Add product. Enter a name, category, cost and selling price, and the stock you have now. The SKU, a short code that tells products apart, is created for you unless you type your own. A photo is optional.", href: "/inventory" },
      { q: "What does the + button do?", a: "It's a shortcut to start a new sale, add an expense, add a product or generate this month's report. It's on the Dashboard and, on phones, next to the bottom bar." },
    ],
  },
  {
    title: "Register and sales",
    articles: [
      { q: "How do I ring up a sale?", a: "Open the Register, search or scan a SKU (or tap products), then take payment. Leave “Cash received” empty for an exact cash payment.", href: "/orders" },
      { q: "Can I put a sale on hold?", a: "Yes. Hold the current sale from the cart and resume it later from the held sales list." },
      { q: "How do I print or find a receipt?", a: "Open Sales and select the sale. The receipt shows in the details panel with a print button.", href: "/records" },
      { q: "Why is a sale marked Queued?", a: "It was made while offline. It's saved on this device and is sent automatically when you're back online. You can also press Save in the header." },
    ],
  },
  {
    title: "Inventory and suppliers",
    articles: [
      { q: "How do I restock or correct stock?", a: "In Inventory, select a product and press Restock (stock you received) or Adjust (damage, lost items or count corrections). Every change is kept in the History tab.", href: "/inventory" },
      { q: "Why can't I type a new stock number when editing a product?", a: "Stock only changes through restocks, adjustments and sales, so the numbers always add up. Use Restock or Adjust instead." },
      { q: "How do low-stock warnings work?", a: "Each product has a “Warn me at” level (5 by default). At or below it the product is marked Low; at zero it's Out." },
      { q: "Can I add my own columns, like Brand?", a: "Yes. Use the Columns button on Inventory, Suppliers or Expenses. New columns appear in the table, the form and search." },
      { q: "How do I track suppliers?", a: "Add them in Suppliers, then pick the supplier when you restock. Each supplier shows what you bought and when they last delivered.", href: "/suppliers" },
    ],
  },
  {
    title: "Expenses and reports",
    articles: [
      { q: "How do I record an expense?", a: "Open Expenses and add the date, category, amount and how it was paid. The Dashboard shows what's left after expenses.", href: "/expenses" },
      { q: "Where are my monthly and yearly reports?", a: "Reports are made automatically for every month and year with records. Open Reports and filter by type or date. Generate report makes this month's report on demand.", href: "/reports" },
      { q: "How do I export a report?", a: "Open a report and choose PDF (your browser's “Save as PDF”), Excel (a file Excel opens directly) or Share link." },
      { q: "Who can see a share link?", a: "Anyone who has the link, without signing in. The link holds a copy of the report from when you shared it and doesn't change afterwards." },
    ],
  },
  {
    title: "Tables and views",
    articles: [
      { q: "How do I switch between table and cards?", a: "Use the View by filter on any list. Your choice is remembered on this device for each page." },
      { q: "How do I export or delete many rows?", a: "Tick the rows (or cards) you want, then use the buttons in the bar that appears: Export CSV, Delete and more." },
      { q: "Where's an item's ID?", a: "Select the item. Its ID shows in the details panel and in the selection bar." },
    ],
  },
  {
    title: "Offline, sync and account",
    articles: [
      { q: "Does OpenTill work without internet?", a: "Yes. Everything is saved on this device first and synced when the connection returns. Settings shows the connection and anything still waiting to be sent.", href: "/settings" },
      { q: "I'm a cashier. Why don't I see Inventory, Expenses or Settings?", a: "Cashier accounts run the register and see the pages their admin turned on for them, such as the Dashboard, Sales, Reports and Recent activity, showing the sales they rang up. Product costs, stock changes, suppliers, expenses, profit and settings stay with your admin, so ask them if you need another page." },
      { q: "How do I change my name, photo or password?", a: "Open Account from the menu. Your photo is saved as soon as you pick it.", href: "/account" },
      { q: "Can I swipe between pages on my phone?", a: "Yes. Swipe left or right to move between the pages in the bottom bar: Dashboard, Suppliers, Inventory and Sales (for cashiers: Dashboard, Sales, Reports and Activity)." },
    ],
  },
];

export default function HelpPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const topics = TOPICS.map((topic) => ({
    ...topic,
    articles: topic.articles.filter((article) => matches(query, article.q, article.a, topic.title)),
  })).filter((topic) => topic.articles.length > 0);
  const searching = query.trim() !== "";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">How can we help?</h2>
            <p className="text-sm text-muted-foreground">Search the guides or browse by topic.</p>
          </div>
          <SearchBox value={query} onChange={setQuery} placeholder="Search help…" className="w-full" />
        </div>

        {topics.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nothing matches “{query.trim()}”. Try another word
            {canOpen(user, "/about") ? (
              <>
                , or see{" "}
                <Link href="/about" className="text-foreground underline-offset-4 hover:underline">
                  About OpenTill
                </Link>
              </>
            ) : null}
            .
          </p>
        ) : (
          topics.map((topic) => (
            <section key={topic.title} className="space-y-2">
              <h3 className="px-1 text-xs font-medium text-muted-foreground">{topic.title}</h3>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {topic.articles.map((article) => (
                  // Native <details>: keyboard and screen-reader friendly with no extra code. Opened while searching.
                  <details key={article.q} open={searching || undefined} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium hover:bg-accent/60 [&::-webkit-details-marker]:hidden">
                      {article.q}
                      <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 px-4 pb-4 text-sm text-muted-foreground">
                      <p>{article.a}</p>
                      {article.href && canOpen(user, article.href) ? (
                        <Link href={article.href} className="inline-block font-medium text-foreground underline-offset-4 hover:underline">
                          Go there →
                        </Link>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
