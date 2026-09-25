import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = "aigate:public";
// Routes are protected unless marked public, so a new controller is never open by accident.
export const Public = () => SetMetadata(IS_PUBLIC, true);
