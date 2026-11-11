document.addEventListener("DOMContentLoaded", () => {
    const productImageUrl = value => {
        const raw = String(value || "").trim();
        if (!raw) return "";
        try {
            const url = new URL(raw, document.baseURI);
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch {
            return "";
        }
    };

    const productApi = initCrudSection({
        section: "sec-products", resource: "products", label: "Product", idKey: "ProductID",
        container: ".product-grid", addButton: /Add Product/i, addLabel: "Add Product", plural: "products",
        searchKeys: ["ProductName", "SKU", "ProductType", "BrandName", "SupplierName"],
        filters: [
            { key: "ProductType", label: "Category", values: rows => [...new Set(rows.map(row => row.ProductType).filter(Boolean))] },
            { key: "BrandID", label: "Brand", get: row => row.BrandID, values: rows => [...new Set(rows.map(row => String(row.BrandID || "")).filter(Boolean))] },
            { key: "Status", label: "Status", values: rows => [...new Set(rows.map(row => row.Status).filter(Boolean))] }
        ],
        fields: [
            { name: "ProductName", label: "Product name", required: true, placeholder: "Name" },
            { name: "SKU", label: "SKU", placeholder: "Unique stock code" },
            { name: "ProductType", label: "Category", options: ["Frames", "Sunglasses", "Contact Lenses", "Lenses", "Accessories", "Other"] },
            { name: "BrandID", label: "Brand", type: "select", lookup: { resource: "brand", value: "BrandID", label: "BrandName" } },
            { name: "SupplierID", label: "Supplier", type: "select", lookup: { resource: "suppliers", value: "SupplierID", label: "SupplierName" } },
            { name: "UnitPrice", label: "Selling price", type: "number", required: true, step: "0.01" },
            { name: "CostPrice", label: "Cost price", type: "number", required: true, step: "0.01" },
            { name: "StockQTy", label: "Opening stock", type: "number", required: true, step: "1", default: 0, hideOnEdit: true },
            { name: "Status", label: "Status", options: ["Active", "Inactive"], default: "Active" },
            { name: "ExpiryDate", label: "Expiry date", type: "date" },
            { name: "Img", label: "Product image URL", full: true, placeholder: "Paste an image URL (https://...)" }
        ],
        renderRow: product => {
            const image = productImageUrl(product.Img);
            const stock = Number(product.StockQTy || 0);
            const stockClass = stock <= 0 ? "out" : stock <= 10 ? "low" : "available";
            return `<article class="product-card">
            <div class="product-card-visual">
                <div class="product-image-placeholder" aria-hidden="true">
                    <svg viewBox="0 0 96 64" fill="none"><path d="M7 29h12l5-12c1-3 4-5 7-5h12c5 0 9 4 9 9v22c0 5-4 9-9 9H28c-6 0-10-4-10-10v-5H7m82-8H77l-5-12c-1-3-4-5-7-5H53c-5 0-9 4-9 9v22c0 5 4 9 9 9h15c6 0 10-4 10-10v-5h8M44 28h8" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <span>No product photo</span>
                </div>
                ${image ? `<img class="product-card-image" data-product-image src="${escapeHtml(image)}" alt="${escapeHtml(product.ProductName)}" loading="lazy" decoding="async">` : ""}
                <span class="product-card-category">${escapeHtml(product.ProductType || "Product")}</span>
                <span class="product-card-status ${String(product.Status || "Active").toLowerCase() === "active" ? "is-active" : "is-inactive"}">${escapeHtml(product.Status || "Active")}</span>
            </div>
            <div class="product-card-body">
                <div class="product-card-title-row">
                    <div><h3 class="product-card-title">${escapeHtml(product.ProductName || "Unnamed product")}</h3><p class="product-card-sku">SKU ${escapeHtml(product.SKU || "Not set")}</p></div>
                    <span class="product-card-id">#${escapeHtml(product.ProductID)}</span>
                </div>
                <div class="product-card-details">
                    <span>${escapeHtml(product.BrandName || "Unbranded")}</span>
                    <span>${escapeHtml(product.SupplierName || "No supplier")}</span>
                </div>
                <div class="product-card-price-row"><span class="product-card-price">${fmtMoney(product.UnitPrice)}</span><span class="product-card-cost">Cost ${fmtMoney(product.CostPrice)}</span></div>
                <div class="product-card-footer"><span class="product-stock ${stockClass}"><span aria-hidden="true"></span>${stock} in stock</span>
                    <div class="product-card-actions">
                        <button type="button" class="product-card-action edit" data-action="edit" data-id="${escapeHtml(product.ProductID)}" aria-label="Edit ${escapeHtml(product.ProductName)}" title="Edit product">
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Edit</span>
                        </button>
                        <button type="button" class="product-card-action delete" data-action="delete" data-id="${escapeHtml(product.ProductID)}" aria-label="Delete ${escapeHtml(product.ProductName)}" title="Delete product">
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Delete</span>
                        </button>
                    </div>
                </div>
            </div>
        </article>`;
        },
        actions: {},
        onRender: () => {
            document.querySelectorAll("#sec-products [data-product-image]").forEach(image => {
                const showImage = () => {
                    image.classList.add("is-loaded");
                    image.closest(".product-card-visual")?.classList.add("has-image");
                };
                image.addEventListener("load", showImage, { once: true });
                image.addEventListener("error", () => image.remove(), { once: true });
                if (image.complete && image.naturalWidth > 0) showImage();
            });
        },
        afterChange: () => { clearLookup("brand"); clearLookup("suppliers"); }
    });

    document.getElementById("exportProductsBtn")?.addEventListener("click", () => {
        const rows = productApi?.state.rows || [];
        downloadCsv("products.csv", ["ProductID", "ProductName", "SKU", "ProductType", "BrandName", "SupplierName", "UnitPrice", "CostPrice", "StockQTy", "Status"],
            rows.map(row => [row.ProductID, row.ProductName, row.SKU, row.ProductType, row.BrandName, row.SupplierName, row.UnitPrice, row.CostPrice, row.StockQTy, row.Status]));
    });
});
