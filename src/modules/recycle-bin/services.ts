import RecycleBin from "./recycle-bin.model";
import { RecycleBinInterface } from "./recycle-bin.interface";

export const recycleItem = async (itemId: string, modelName: string): Promise<void> => {

  try {
    // Copy to recycle bin
    const recycleBinEntry: RecycleBinInterface = new RecycleBin({
      originalId: itemId,
      model: modelName,
      deletedAt: new Date(),
    });

    await recycleBinEntry.save();
  } catch (error) {
    throw error
  }
};

// export const restoreItem = async (itemId: string, modelName: string): Promise<void> => {

// };