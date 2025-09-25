import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Eye, Heart, Users, Star, Trophy, Shield, Zap, User, Quote } from 'lucide-react';

export default function Sobre() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = 'Sobre Nós | Centro de Lutas';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Conheça a história por trás do Centro de Lutas, uma plataforma criada por quem vive o tatame para simplificar a gestão de academias de artes marciais no Brasil.');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Conheça a história por trás do Centro de Lutas, uma plataforma criada por quem vive o tatame para simplificar a gestão de academias de artes marciais no Brasil.';
      document.head.appendChild(meta);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        
        {/* Seção de Título Principal */}
        <section className="text-center mb-20">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
            Nossa Luta é Simplificar a Sua.
          </h1>
          <h2 className="text-xl md:text-2xl text-muted-foreground font-medium">
            Feito por quem vive o tatame.
          </h2>
        </section>

        {/* Seção da História de Origem */}
        <section className="mb-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
              Do Caos das Planilhas à Organização com um Clique.
            </h2>
            
            <div className="prose prose-lg max-w-none text-foreground">
              <p className="text-lg md:text-xl leading-relaxed mb-8 text-muted-foreground">
                Como muitos de vocês, nossa jornada começou no tatame. A paixão por ensinar, por ver a evolução de cada aluno, sempre foi nosso maior combustível.
              </p>
              
              <p className="text-lg md:text-xl leading-relaxed mb-8 text-muted-foreground">
                Mas, fora do tatame, a realidade era outra. Nos víamos perdidos em planilhas intermináveis, gastando horas para controlar presenças, cobrar mensalidades atrasadas e organizar as turmas. A burocracia estava roubando o tempo que deveríamos dedicar aos nossos alunos.
              </p>
              
              <p className="text-lg md:text-xl leading-relaxed mb-8 text-muted-foreground">
                Foi então que percebemos: e se existisse uma ferramenta pensada exatamente para nós? Uma plataforma que entendesse a diferença entre um dojo e uma academia convencional? Que falasse a nossa língua?
              </p>
              
              <p className="text-lg md:text-xl leading-relaxed text-muted-foreground">
                Assim nasceu o Centro de Lutas. Não como um negócio, mas como uma missão: devolver aos mestres e professores o seu bem mais precioso, o tempo. Criamos uma plataforma para que você possa focar no que realmente importa: formar atletas, compartilhar conhecimento e transformar vidas.
              </p>
            </div>
          </div>
        </section>

        {/* Seção de Missão, Visão e Valores */}
        <section className="mb-20">
          <div className="grid md:grid-cols-3 gap-8">
            
            {/* Nossa Missão */}
            <Card className="text-center p-8 hover-elevate">
              <CardContent className="pt-6">
                <div className="bg-primary/20 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                  <Target className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-4">Nossa Missão</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Empoderar donos de academias de artes marciais com uma gestão simples e poderosa, permitindo que dediquem mais tempo ao ensino e à formação de seus alunos.
                </p>
              </CardContent>
            </Card>

            {/* Nossa Visão */}
            <Card className="text-center p-8 hover-elevate">
              <CardContent className="pt-6">
                <div className="bg-accent/20 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                  <Eye className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-4">Nossa Visão</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Ser a plataforma de gestão mais confiável e recomendada pela comunidade de artes marciais no Brasil, ajudando a profissionalizar e fortalecer o setor como um todo.
                </p>
              </CardContent>
            </Card>

            {/* Nossos Valores */}
            <Card className="text-center p-8 hover-elevate">
              <CardContent className="pt-6">
                <div className="bg-primary/20 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                  <Heart className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-4">Nossos Valores</h3>
                <div className="space-y-3 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <span className="text-sm">Paixão pelo Tatame</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-sm">Simplicidade é Poder</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm">Parceria e Suporte</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="text-sm">Inovação Constante</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Seção "Conheça o Fundador" */}
        <section className="mb-20">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              
              {/* Imagem do Fundador */}
              <div className="text-center">
                <div className="bg-muted rounded-full w-80 h-80 mx-auto mb-6 flex items-center justify-center">
                  <User className="h-32 w-32 text-muted-foreground" />
                </div>
              </div>

              {/* Texto do Fundador */}
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Conheça o Fundador
                </h2>
                
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  [Inserir Nome do Fundador]
                </h3>
                
                <Badge className="mb-6" variant="secondary">
                  Fundador e Apaixonado por Artes Marciais
                </Badge>
                
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Com mais de [X] anos de experiência em [arte marcial], uniu sua paixão pelo esporte com seu conhecimento em tecnologia para criar a solução que ele mesmo precisava. Hoje, ele se dedica a ajudar outras academias a superarem os mesmos desafios que um dia o inspiraram a criar o Centro de Lutas.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Seção de Prova Social */}
        <section className="mb-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
              O que Dizem Sobre Nós
            </h2>
            
            <Card className="p-8 text-center bg-accent/5 border-accent/20 hover-elevate">
              <CardContent className="pt-6">
                <Quote className="h-12 w-12 text-accent-foreground mx-auto mb-6 opacity-50" />
                <p className="text-xl italic text-foreground mb-6 leading-relaxed">
                  "O Centro de Lutas mudou o jogo para a minha academia. Finalmente tenho tempo para focar nos treinos!"
                </p>
                <div className="flex items-center justify-center gap-2">
                  <div className="flex text-yellow-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-current" />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3 mt-4">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium text-center">
                    <strong>Mestre [Nome]</strong><br />
                    [Nome da Academia]
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Seção Final de CTA */}
        <section className="text-center">
          <div className="bg-primary/10 rounded-2xl p-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Junte-se a Centenas de Academias que Estão Transformando sua Gestão.
            </h2>
            
            <Button 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={() => setLocation('/precos')}
              data-testid="button-cta-planos"
            >
              VEJA NOSSOS PLANOS E COMECE SEU TESTE GRÁTIS
            </Button>
          </div>
        </section>

      </div>
    </div>
  );
}