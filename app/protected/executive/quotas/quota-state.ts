export type UpdateSalesQuotaState = {
  success: boolean;
  error: string | null;
  message: string | null;
};

export const INITIAL_UPDATE_QUOTA_STATE: UpdateSalesQuotaState = {
  success: false,
  error: null,
  message: null,
};
