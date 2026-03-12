
import { Dexie, Table } from 'dexie';
import { DesignDNA } from '../types';

class DesignAppDB extends Dexie {
  designs!: Table<DesignDNA, number>; 

  constructor() {
    super('DesignAppDB_v2'); // Upgrade version to handle new schema
    
    // Fix: Using type assertion to any to resolve property visibility issues for Dexie's version method
    (this as any).version(2).stores({
      designs: '++id, createdAt, author, seed'
    });
  }
}

export const db = new DesignAppDB();

/**
 * Lưu thiết kế vào lịch sử kèm thông tin tác giả.
 */
export const saveDesignToHistory = async (data: Omit<DesignDNA, 'id' | 'createdAt'>): Promise<number> => {
  try {
    const timestamp = Date.now();
    const id = await db.designs.add({
      ...data,
      createdAt: timestamp
    });
    console.log(`[HistoryDB] Saved design #${id} by ${data.author}`);
    return id as number;
  } catch (error) {
    console.error(`[HistoryDB] Failed to save design:`, error);
    throw error;
  }
};

/**
 * Lấy tất cả thiết kế.
 */
export const getAllDesigns = async (): Promise<DesignDNA[]> => {
  try {
    return await db.designs.orderBy('createdAt').reverse().toArray();
  } catch (error) {
    console.error(`[HistoryDB] Failed to fetch designs:`, error);
    return [];
  }
};

/**
 * Xóa toàn bộ dữ liệu của một tác giả cụ thể (Quyền riêng tư).
 */
export const deleteDesignsByAuthor = async (authorName: string): Promise<number> => {
    try {
        const count = await db.designs.where('author').equals(authorName).delete();
        console.log(`[HistoryDB] Deleted ${count} designs for author ${authorName}`);
        return count;
    } catch (error) {
        console.error(`[HistoryDB] Failed to delete designs for author ${authorName}:`, error);
        throw error;
    }
};

export const deleteDesign = async (id: number): Promise<void> => {
    try {
        await db.designs.delete(id);
    } catch (error) {
        console.error(`[HistoryDB] Failed to delete design #${id}:`, error);
        throw error;
    }
};
