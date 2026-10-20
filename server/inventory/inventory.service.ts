import { BadRequestException, ForbiddenException, Inject, NotFoundException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { ProductsService } from "../products/products.service";
import { RealtimeService } from "../realtime/realtime.service";
import { TenantsService } from "../tenants/tenants.service";

export type MovementType = "OPENING" | "RESTOCK" | "ADJUSTMENT" | "SALE";

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number; // signed
  unitCost: number | null;
  supplierId: string | null;
  note: string;
  date: string | Date;
}

@Injectable()
export class InventoryService {
  private memoryMovements: StockMovement[] = [];

  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
    @Inject(ProductsService) private readonly products: ProductsService,
    @Inject(TenantsService) private readonly tenants: TenantsService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService
  ) {}

  private async find(id: string): Promise<StockMovement | null> {
    if (this.dbService.client) {
      try {
        return (await this.dbService.client.stockMovement.findUnique({ where: { id } })) as StockMovement | null;
      } catch (err: any) {
        console.error("Failed to load stock movement, falling back:", err.message);
      }
    }
    return this.memoryMovements.find((m) => m.id === id) ?? null;
  }

  private async insert(movement: StockMovement) {
    if (this.dbService.client) {
      try {
        await this.dbService.client.stockMovement.create({ data: movement as any });
        return;
      } catch (err: any) {
        console.error("Failed to save stock movement, falling back to memory:", err.message);
      }
    }
    this.memoryMovements.push(movement);
  }

  async findAll(userId: string): Promise<StockMovement[]> {
    const owned = await this.tenants.ownedIds(userId);
    if (owned.size === 0) return [];
    if (this.dbService.client) {
      try {
        return (await this.dbService.client.stockMovement.findMany({
          where: { tenantId: { in: [...owned] } },
          orderBy: { date: "desc" },
        })) as StockMovement[];
      } catch (err: any) {
        console.error("Failed to query stock movements, falling back:", err.message);
      }
    }
    return this.memoryMovements.filter((m) => owned.has(m.tenantId));
  }

  /** Apply a stock change from the UI. Replaying the same id is a no-op, so offline retries can't double count. */
  async record(userId: string, id: string, body: any): Promise<StockMovement> {
    const existing = await this.find(id);
    if (existing) {
      if (!(await this.tenants.owns(userId, existing.tenantId))) {
        throw new ForbiddenException("You do not have access to this store.");
      }
      return existing;
    }
    if (!body?.tenantId || !(await this.tenants.owns(userId, body.tenantId))) {
      throw new ForbiddenException("You do not have access to this store.");
    }
    const type = ["OPENING", "RESTOCK", "ADJUSTMENT"].includes(body.type) ? (body.type as MovementType) : null;
    const quantity = parseInt(body.quantity);
    if (!type || !quantity || (type !== "ADJUSTMENT" && quantity < 0)) {
      throw new BadRequestException("Invalid stock movement.");
    }
    const product = await this.products.getById(body.productId);
    if (!product) throw new NotFoundException("Product not found.");
    if (product.tenantId !== body.tenantId) throw new ForbiddenException("You do not have access to this store.");

    const unitCost = parseFloat(body.unitCost);
    const date = new Date(body.date);
    const movement: StockMovement = {
      id,
      tenantId: body.tenantId,
      productId: product.id,
      productName: product.name,
      type,
      quantity,
      unitCost: unitCost > 0 ? unitCost : null,
      supplierId: body.supplierId || null,
      note: String(body.note ?? "").trim().slice(0, 200),
      date: Number.isNaN(date.getTime()) ? new Date() : date,
    };
    await this.insert(movement);
    await this.products.adjustStock(
      product.id,
      quantity,
      type === "ADJUSTMENT" ? undefined : { unitCost: movement.unitCost, supplierId: movement.supplierId }
    );
    this.realtime.emit(movement.tenantId, "stock");
    this.realtime.emit(movement.tenantId, "products");
    return movement;
  }

  /** Ledger entry for a sale. Stock was already deducted by the order sync, so this only records it. Never throws. */
  async logSale(item: { id: string; productId: string; name: string; quantity: number }, order: { tenantId: string; date: Date }) {
    try {
      const id = `mov-sale-${item.id}`;
      if (await this.find(id)) return;
      await this.insert({
        id,
        tenantId: order.tenantId,
        productId: item.productId,
        productName: item.name,
        type: "SALE",
        quantity: -item.quantity,
        unitCost: null,
        supplierId: null,
        note: "",
        date: order.date,
      });
    } catch (err: any) {
      console.warn("Could not log sale movement:", err.message);
    }
  }
}
