import { useEffect, useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link } from "react-router";
import { authenticate } from "../shopify.server";
import "../styles/shared.css";

const PAGE_SIZE = 25;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "all";
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");

  const queryParts: string[] = [];
  if (search.trim()) queryParts.push(`title:*${search.trim()}*`);
  if (status !== "all") queryParts.push(`status:${status}`);
  const queryString = queryParts.join(" AND ") || null;

  const paginationVars = before
    ? { last: PAGE_SIZE, before }
    : { first: PAGE_SIZE, after: after ?? null };

  const response = await admin.graphql(
    `#graphql
      query GetProducts($first: Int, $after: String, $last: Int, $before: String, $query: String) {
        products(first: $first, after: $after, last: $last, before: $before, query: $query, sortKey: TITLE) {
          edges {
            cursor
            node {
              id
              title
              vendor
              status
              featuredImage { url }
              priceRangeV2 { minVariantPrice { amount currencyCode } }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }`,
    { variables: { ...paginationVars, query: queryString } },
  );
  const data = await response.json();

  const edges = data.data.products.edges;
  const products = edges.map((e: any) => ({
    id: e.node.id,
    title: e.node.title,
    vendor: e.node.vendor,
    status: e.node.status,
    imageUrl: e.node.featuredImage?.url as string | undefined,
    price: e.node.priceRangeV2?.minVariantPrice?.amount,
  }));

  return {
    products,
    pageInfo: data.data.products.pageInfo,
    firstCursor: edges[0]?.cursor ?? null,
    lastCursor: edges[edges.length - 1]?.cursor ?? null,
    search,
    status,
  };
};

type LoaderData = ReturnType<typeof useLoaderData<typeof loader>>;

export default function Products() {
  const initialData = useLoaderData<typeof loader>();
  const searchFetcher = useFetcher<typeof loader>();
  const [search, setSearch] = useState(initialData.search);
  const [status, setStatus] = useState(initialData.status);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whichever is most recent: a live search result, or the initial page load.
  const data = searchFetcher.data ?? initialData;
  const { products, pageInfo, firstCursor, lastCursor } = data;
  const isSearching = searchFetcher.state === "loading";

  const runSearch = (
    q: string,
    s: string,
    extra: Record<string, string | null> = {},
  ) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (s !== "all") params.set("status", s);
    Object.entries(extra).forEach(([key, value]) => {
      if (value === null) params.delete(key);
      else params.set(key, value);
    });
    searchFetcher.load(`/app/products?${params.toString()}`);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(value, status);
    }, 350);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    runSearch(search, value);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    runSearch("", "all");
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p: any) => p.id)));
    }
  };

  const goPrevious = () =>
    runSearch(search, status, { after: null, before: firstCursor });
  const goNext = () =>
    runSearch(search, status, { before: null, after: lastCursor });

  return (
    <div className="ps-canvas">
      <div className="ps-wrap">
        <div className="ps-header">
          <div>
            <h1>Products</h1>
            <p>Browse and bulk-select products without leaving Producted.</p>
          </div>
          <span className="ps-eyebrow">FUSIONS · Producted</span>
        </div>

        <div className="ps-toolbar">
          <input
            className="ps-input"
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <select
            className="ps-select"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          {(search || status !== "all") && (
            <button
              className="ps-btn-outline"
              onClick={clearFilters}
              style={{ background: "#fff", flexShrink: 0 }}
            >
              Clear
            </button>
          )}
        </div>

        {selected.size > 0 && (
          <div className="ps-bulk-bar">
            <span>{selected.size} selected</span>
            <Link
              to={`/app/rules?targetIds=${encodeURIComponent(Array.from(selected).join(","))}`}
            >
              <button className="ps-btn-primary">Use as rule target</button>
            </Link>
          </div>
        )}

        <div
          className="ps-card"
          style={{
            opacity: isSearching ? 0.6 : 1,
            transition: "opacity 0.15s ease",
          }}
        >
          <table className="ps-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={
                      products.length > 0 && selected.size === products.length
                    }
                    onChange={toggleAll}
                  />
                </th>
                <th></th>
                <th>Title</th>
                <th>Vendor</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="ps-empty">
                    {isSearching
                      ? "Searching…"
                      : "No products match your search."}
                  </td>
                </tr>
              )}
              {products.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                  </td>
                  <td>
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div className="ps-row-thumb" />
                    )}
                  </td>
                  <td>{p.title}</td>
                  <td>{p.vendor || "—"}</td>
                  <td>{p.price ? `$${p.price}` : "—"}</td>
                  <td>
                    <span
                      className={`ps-pill ${
                        p.status === "ACTIVE"
                          ? "ps-pill-success"
                          : p.status === "DRAFT"
                            ? "ps-pill-neutral"
                            : "ps-pill-danger"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(pageInfo.hasNextPage || pageInfo.hasPreviousPage) && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              marginTop: 16,
            }}
          >
            <button
              className="ps-btn-outline"
              onClick={goPrevious}
              disabled={!pageInfo.hasPreviousPage}
            >
              ← Previous
            </button>
            <button
              className="ps-btn-outline"
              onClick={goNext}
              disabled={!pageInfo.hasNextPage}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
