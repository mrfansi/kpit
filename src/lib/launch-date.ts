import { addDays, format, parseISO } from "date-fns";

export function getEffectiveLaunchDate(project: {
  endDate: string;
  launchBufferDays: number;
  estimatedLaunchDate: string | null;
}): string {
  if (project.estimatedLaunchDate) {
    return project.estimatedLaunchDate;
  }
  return format(addDays(parseISO(project.endDate), project.launchBufferDays), "yyyy-MM-dd");
}

export function isManualLaunchDate(project: {
  estimatedLaunchDate: string | null;
}): boolean {
  return project.estimatedLaunchDate !== null;
}
