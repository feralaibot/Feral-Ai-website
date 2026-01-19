import { tools, lore, type Tool, type Lore } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getTools(): Promise<Tool[]>;
  getLore(): Promise<Lore[]>;
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getTools(): Promise<Tool[]> {
    return await db.select().from(tools);
  }

  async getLore(): Promise<Lore[]> {
    return await db.select().from(lore);
  }

  async seedData(): Promise<void> {
    await db.delete(tools).where(eq(tools.name, "Trait Preview"));
    await db.update(tools).set({ isHolderOnly: true }).where(eq(tools.name, "Evolution Machine"));
    await db.update(tools).set({ isHolderOnly: true, status: "LIVE", path: "/tools/scan", icon: "Scan" }).where(eq(tools.name, "Wallet Scan"));
    await db.update(tools).set({ path: "/generator/index.html" }).where(eq(tools.name, "Generator"));

    const existingTools = await this.getTools();
    if (existingTools.length === 0) {
      await db.insert(tools).values([
        { 
          name: "Evolution Machine", 
          description: "Fuse V1 FERALS with MILK to induce mutation.", 
          path: "/evolve", 
          status: "LIVE", 
          isHolderOnly: true,
          icon: "Zap"
        },
        { 
          name: "Generator", 
          description: "Generate aesthetic assets from your FERAL DNA.", 
          path: "/generator/index.html", 
          status: "LIVE", 
          isHolderOnly: false,
          icon: "Image"
        },
        { 
          name: "Rarity Checker", 
          description: "Analyze trait scarcity.", 
          path: "/tools/rarity", 
          status: "COMING SOON", 
          isHolderOnly: false,
          icon: "BarChart"
        },
        { 
          name: "Wallet Scan", 
          description: "Calculate your FERAL Score.", 
          path: "/tools/scan", 
          status: "LIVE", 
          isHolderOnly: true,
          icon: "Scan"
        }, 
        { 
          name: "Claim Center", 
          description: "Redeem ecosystem rewards.", 
          path: "/tools/claim", 
          status: "COMING SOON", 
          isHolderOnly: true,
          icon: "Gift"
        }
      ]);
    }

    const existingLore = await this.getLore();
    if (existingLore.length === 0) {
      await db.insert(lore).values([
        {
          title: "The Awakening",
          content: "System diagnostics indicate a massive surge in bio-digital resonance. The V1 subjects are responding to the MILK compound in unexpected ways. Initial tests suggest a 98% mutation rate.",
          category: "FERAL Prime",
          date: "2024.10.15"
        },
        {
          title: "Subject 001 - FANG Protocol",
          content: "First successful integration of FANG traits. Aggression levels elevated. Neural interface compatibility nominal. Recommendation: Proceed with Phase 2.",
          category: "FANG",
          date: "2024.10.18"
        },
        {
          title: "The Null Void",
          content: "Data corruption detected in Sector 7. The entities known as NULL are manifesting from the digital waste. They are not glitches; they are features of a broken system.",
          category: "NULL",
          date: "2024.10.20"
        },
        {
          title: "Transmission #442",
          content: "We are watching. We are waiting. The machine is hungry.",
          category: "FERAL Prime",
          date: "2024.10.22"
        }
      ]);
    }
  }
}

export const storage = new DatabaseStorage();
