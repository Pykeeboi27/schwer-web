export type UpdateAnnualTargetState = {
  success: boolean;
  error: string | null;
  message: string | null;
};

export const INITIAL_UPDATE_TARGET_STATE: UpdateAnnualTargetState = {
  success: false,
  error: null,
  message: null,
};
