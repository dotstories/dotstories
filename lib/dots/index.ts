import { type Dot, DotSchema } from "../dot";
import { darkFantasy } from "./dark-fantasy";

/** All dots. Static for now; from the database once publishing exists. */
export const dots: Dot[] = [darkFantasy].map((d) => DotSchema.parse(d) && d);

export const findDot = (slug: string) => dots.find((d) => d.slug === slug);
