import { Bell, CheckCircle2, Clock3, MailPlus, UserRoundPlus, XCircle } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageProvider.jsx";
import { ActionButton, EmptyState } from "../ui.jsx";

function InviteCard({ invite, isIncoming, busy, onRespond, t }) {
  const person = isIncoming ? invite.sender : invite.recipient;

  return (
    <article className="rounded-[1.4rem] border border-sky-100 bg-[linear-gradient(180deg,rgba(255,250,243,0.96),rgba(239,247,255,0.88))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {isIncoming
              ? `${t("notifications.from")} ${person?.name ?? ""}`.trim()
              : `${t("notifications.to")} ${person?.name ?? ""}`.trim()}
          </p>
          <p className="mt-1 text-sm text-slate-500">{person?.email}</p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            <Clock3 className="h-3.5 w-3.5" />
            {t("notifications.pending")}
          </p>
        </div>
      </div>

      {isIncoming ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <ActionButton
            busy={busy}
            className="sm:w-auto"
            onClick={() => onRespond(invite.id, "accept")}
            type="button"
          >
            <CheckCircle2 className="h-4 w-4" />
            {t("notifications.accept")}
          </ActionButton>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-sky-100 bg-white/95 px-5 py-3 font-medium text-slate-700 transition hover:bg-amber-50/70 disabled:opacity-70 sm:rounded-2xl"
            disabled={busy}
            onClick={() => onRespond(invite.id, "decline")}
            type="button"
          >
            <XCircle className="h-4 w-4" />
            {t("notifications.decline")}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ActivityCard({ notification, t, locale }) {
  const timestamp = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(notification.createdAt));

  return (
    <article className="rounded-[1.4rem] border border-sky-100 bg-[linear-gradient(180deg,rgba(255,250,243,0.96),rgba(239,247,255,0.88))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{notification.body}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 shadow-sm">
          <Clock3 className="h-3.5 w-3.5" />
          {timestamp}
        </span>
      </div>
    </article>
  );
}

function NotificationsPage({ notifications, notificationsBusy, onRespond }) {
  const { t, locale } = useLanguage();
  const incoming = notifications?.incoming ?? [];
  const outgoing = notifications?.outgoing ?? [];
  const activity = notifications?.activity ?? [];

  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-amber-100/90 p-2.5 text-[#17385d]">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{t("notifications.activityTitle")}</h2>
            <p className="text-sm text-slate-600">{t("notifications.activitySubtitle")}</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {activity.length ? (
            activity.map((notification) => (
              <ActivityCard
                key={`activity-${notification.id}`}
                notification={notification}
                t={t}
                locale={locale}
              />
            ))
          ) : (
            <EmptyState
              title={t("notifications.emptyActivityTitle")}
              body={t("notifications.emptyActivityBody")}
            />
          )}
        </div>
      </div>

      <div className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-100/90 p-2.5 text-[#16995a]">
            <MailPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{t("notifications.sentTitle")}</h2>
            <p className="text-sm text-slate-600">{t("notifications.sentSubtitle")}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("notifications.incoming")}
            </p>
          </div>

          {incoming.length ? (
            incoming.map((invite) => (
              <InviteCard
                key={`incoming-${invite.id}`}
                invite={invite}
                isIncoming
                busy={notificationsBusy}
                onRespond={onRespond}
                t={t}
              />
            ))
          ) : (
            <EmptyState
              title={t("notifications.emptyIncomingTitle")}
              body={t("notifications.emptyIncomingBody")}
            />
          )}

          <div className="pt-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("notifications.sentTitle")}
            </p>
          </div>

          {outgoing.length ? (
            outgoing.map((invite) => (
              <InviteCard
                key={`outgoing-${invite.id}`}
                invite={invite}
                isIncoming={false}
                busy={notificationsBusy}
                onRespond={onRespond}
                t={t}
              />
            ))
          ) : (
            <EmptyState
              title={t("notifications.emptyOutgoingTitle")}
              body={t("notifications.emptyOutgoingBody")}
            />
          )}
        </div>

        <div className="mt-6 rounded-[1.4rem] bg-[linear-gradient(180deg,rgba(255,244,210,0.96),rgba(239,247,255,0.88))] px-4 py-4 text-sm text-slate-600">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <UserRoundPlus className="h-4 w-4" />
            {t("notifications.onlyTwoTitle")}
          </div>
          <p className="mt-2 leading-6">{t("notifications.onlyTwoBody")}</p>
        </div>
      </div>
    </section>
  );
}

export default NotificationsPage;
