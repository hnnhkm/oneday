import { useTranslations } from "next-intl";

export function HowItWorks() {
  const t = useTranslations("home");

  const steps = [
    {
      icon: "🔍",
      title: t("howItWorksStep1Title"),
      desc: t("howItWorksStep1Desc"),
    },
    {
      icon: "📅",
      title: t("howItWorksStep2Title"),
      desc: t("howItWorksStep2Desc"),
    },
    {
      icon: "🎉",
      title: t("howItWorksStep3Title"),
      desc: t("howItWorksStep3Desc"),
    },
  ];

  return (
    <section className="py-12 bg-white">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-xl sm:text-2xl font-bold text-charcoal text-center mb-8">
          {t("howItWorksTitle")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl sm:text-4xl mb-3">{step.icon}</div>
              <h3 className="text-base sm:text-lg font-semibold text-charcoal mb-2">
                {step.title}
              </h3>
              <p className="text-sm sm:text-base text-charcoal-lighter">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
