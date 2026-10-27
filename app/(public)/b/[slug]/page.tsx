import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { BottomBar } from "@/components/bottom-bar";
import { Toaster } from "@/components/ui/sonner";
import { getBusinessPage } from "@/features/business-page/api/get-business-page";
import { BusinessAbout } from "@/features/business-page/components/business-about";
import { BusinessActions, hasActions } from "@/features/business-page/components/business-actions";
import { BusinessPhotos } from "@/features/business-page/components/business-photos";
import { BusinessSideCard } from "@/features/business-page/components/business-side-card";
import { BusinessSummary } from "@/features/business-page/components/business-summary";
import { OpeningHours } from "@/features/business-page/components/opening-hours";
import { ServiceList } from "@/features/business-page/components/service-list";
import { ShareButton } from "@/features/business-page/components/share-button";
import { TeamList } from "@/features/business-page/components/team-list";
import { getWeekdayInTimeZone } from "@/features/business-page/utils/get-weekday-in-time-zone";
import { groupHours } from "@/features/business-page/utils/group-hours";
import { isOpenNow } from "@/features/business-page/utils/is-open-now";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBusinessPage(slug);
  if (!data) {
    notFound();
  }
  return {
    title: data.business.name,
    description: data.business.description ?? undefined,
  };
}

export default async function BusinessPage({ params }: Props) {
  const { slug } = await params;
  const data = await getBusinessPage(slug);
  if (!data) {
    notFound();
  }
  const { business, hours, services, team, photos } = data;
  // No hours saved: say nothing rather than "Closed now".
  const open = hours.length > 0 ? isOpenNow(hours, business.timezone) : null;

  return (
    <>
      <main className="mx-auto w-full max-w-6xl pb-28 md:px-6 md:pt-6 md:pb-16">
        <BusinessPhotos photos={photos} />
        <div className="grid gap-8 px-4 pt-5 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-10 md:px-0 md:pt-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-8">
            <div className="flex items-start justify-between gap-3">
              <BusinessSummary business={business} open={open} />
              <div className="flex shrink-0 gap-2 md:hidden">
                <ThemeToggle />
                <ShareButton title={business.name} />
              </div>
            </div>
            <ServiceList services={services} currency={business.currency} />
            <TeamList team={team} />
            <OpeningHours
              days={groupHours(hours)}
              todayWeekday={getWeekdayInTimeZone(business.timezone)}
            />
            <BusinessAbout description={business.description} />
          </div>
          <aside className="hidden md:block">
            <BusinessSideCard business={business} open={open} />
          </aside>
        </div>
      </main>
      {hasActions(business) && (
        <BottomBar label="Contact" className="md:hidden">
          <BusinessActions business={business} layout="row" />
        </BottomBar>
      )}
      <Toaster />
    </>
  );
}
