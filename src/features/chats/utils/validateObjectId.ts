export const validateObjectId = (id: string) => /^[a-f\d]{24}$/i.test(id || "");
