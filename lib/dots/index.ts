import { type Dot, DotSchema } from "../dot";
import { darkFantasy } from "./dark-fantasy";
import { darkFantasyMusic } from "./dark-fantasy-music";

/** All dots. Static for now; from the database once publishing exists. Validated at build time. */
export const dots: Dot[] = [darkFantasy, darkFantasyMusic].map((d) => DotSchema.parse(d) && d);

export const findDot = (slug: string) => dots.find((d) => d.slug === slug);
