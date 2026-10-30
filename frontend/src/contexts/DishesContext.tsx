import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Category, Dish } from '../types/dish';
import { dishService } from '../services/dishService';
import { settingsService } from '../services/settingsService';
import { dishes as fallbackDishes, MENU_CATEGORIES as fallbackCategories } from '../data/dishes';

interface DishesContextValue {
  dishes: Dish[];
  categories: Category[];
  isLoading: boolean;
  error: string;
  maxDishQuantity: number;
  refresh: () => Promise<void>;
  getById: (id?: string) => Dish | undefined;
}

const DishesContext = createContext<DishesContextValue | undefined>(undefined);

function getErrorMessage(error: any) {
  return error?.response?.data?.message || error?.message || 'Không thể tải thực đơn. Vui lòng thử lại.';
}

export function DishesProvider({ children }: { children: React.ReactNode }) {
  const [dishes, setDishes] = useState<Dish[]>(fallbackDishes as unknown as Dish[]);
  const [categories, setCategories] = useState<Category[]>(fallbackCategories as unknown as Category[]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [maxDishQuantity, setMaxDishQuantity] = useState(10);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [loadedCategories, firstPage, settings] = await Promise.all([
        dishService.getCategories(),
        dishService.getDishes({ page: 1, limit: 100 }),
        settingsService.getSettings().catch(() => []),
      ]);
      const settingsByKey = Object.fromEntries(settings.map((setting) => [setting.setting_key, setting.setting_value]));
      const configuredLimit = Number(settingsByKey.max_dish_quantity_per_order);
      setMaxDishQuantity(Math.min(10, Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 10));
      const allDishes = [...firstPage.items];
      const pageCount = Math.ceil(firstPage.total / 100);
      for (let page = 2; page <= pageCount; page += 1) {
        const result = await dishService.getDishes({ page, limit: 100 });
        allDishes.push(...result.items);
      }
      setCategories(loadedCategories);
      setDishes(allDishes);
    } catch (loadError) {
      console.warn('Backend API offline or unreachable, falling back to local dishes dataset:', loadError);
      setCategories(fallbackCategories as unknown as Category[]);
      setDishes(fallbackDishes as unknown as Dish[]);
      setError('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getById = useCallback((id?: string) => dishes.find((dish) => dish.id === id), [dishes]);
  const value = useMemo(
    () => ({ dishes, categories, isLoading, error, maxDishQuantity, refresh, getById }),
    [dishes, categories, isLoading, error, maxDishQuantity, refresh, getById],
  );

  return <DishesContext.Provider value={value}>{children}</DishesContext.Provider>;
}

export function useDishes() {
  const context = useContext(DishesContext);
  if (!context) throw new Error('useDishes must be used within DishesProvider');
  return context;
}
