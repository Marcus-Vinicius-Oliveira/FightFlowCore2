import { Button } from "@/components/ui/button";
import { ArrowRight, DollarSign, Users, Calendar } from "lucide-react";
import heroImage from "@assets/generated_images/martial_arts_academy_hero_4c8fadf9.png";

export function LandingHero() {
  return (
    <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Hero Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${heroImage})`
        }}
      >
        {/* Dark overlay for text contrast */}
        <div className="absolute inset-0 bg-black/60" />
      </div>
      
      {/* Hero Content */}
      <div className="relative z-10 container px-4 py-20 text-center text-white">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Gerencie sua Academia de
            <span className="block text-orange-400">Artes Marciais com Facilidade</span>
          </h1>
          
          <p className="text-xl md:text-2xl mb-8 text-gray-200 max-w-3xl mx-auto leading-relaxed">
            Plataforma SaaS completa para academias de artes marciais. Gerencie alunos, aulas, 
            presença e pagamentos tudo em um sistema seguro e profissional.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              variant="default"
              className="text-lg px-8 py-3 bg-orange-500 hover:bg-orange-600 border-orange-600"
              data-testid="button-get-started"
              onClick={() => console.log('Get started clicked')}
            >
              Comece Grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 py-3 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
              data-testid="button-watch-demo"
              onClick={() => console.log('Watch demo clicked')}
            >
              Ver Demonstração
            </Button>
          </div>
          
          {/* Feature highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-full p-3 mb-4">
                <Users className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Gestão de Alunos</h3>
              <p className="text-gray-300">Perfis completos de alunos e acompanhamento de matrículas</p>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-full p-3 mb-4">
                <Calendar className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Agendamento de Aulas</h3>
              <p className="text-gray-300">Gestão fácil de aulas com controle de presença</p>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-full p-3 mb-4">
                <DollarSign className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Controle Financeiro</h3>
              <p className="text-gray-300">Gestão completa de mensalidades e relatórios financeiros</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}