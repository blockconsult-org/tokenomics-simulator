import { Simulator } from '@/simulator/components/simulator';
import { getSimulatorPage } from '@/simulator/content/page';
import '@/simulator/styles/simulator.css';
import '@/simulator/styles/charts.css';
export default function Page({ locale }: { locale: 'en' | 'de' }) {
 const page = getSimulatorPage(locale);
 return <><header className="mx-auto max-w-[90rem] px-6 py-10 md:px-8"><p className="text-xs uppercase tracking-widest text-muted">Block Consult / Web3</p><h1 className="mt-4 text-display-md font-semibold">{page.hero.title}</h1><p className="mt-4 max-w-3xl text-muted">{page.hero.lead}</p></header><Simulator locale={locale} pageUrl={'https://www.blockconsult.org' + (locale === 'de' ? '/de' : '') + '/tokenomics-simulator'} /><section className="mx-auto max-w-[90rem] px-6 py-10 md:px-8"><h2 className="text-xl">{page.notice.title}</h2><p className="mt-4 max-w-3xl text-muted">{page.notice.body}</p></section></>;
}
