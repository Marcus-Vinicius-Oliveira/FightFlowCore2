import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/Navbar";
import { 
  Check, 
  Star, 
  Clock, 
  Users, 
  Calendar, 
  CreditCard, 
  BarChart3, 
  Phone,
  ChevronDown
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

export default function Precos() {
  const [, setLocation] = useLocation();
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const toggleFaq = (faqId: string) => {
    setOpenFaq(openFaq === faqId ? null : faqId);
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-16">
        {/* Header Section */}
        <section className="bg-gradient-to-br from-primary/5 via-background to-accent/10 py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
              Planos flexíveis para sua academia crescer.
            </h1>
            <h2 className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Menos burocracia, mais tempo no tatame.
            </h2>
          </div>
        </section>

        {/* Oferta de Lançamento Section */}
        <section className="py-20 bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="bg-card rounded-2xl p-8 md:p-12 border-2 border-primary/20 shadow-lg">
                <Badge className="bg-primary text-primary-foreground text-lg px-6 py-2 mb-6">
                  <Star className="h-4 w-4 mr-2" />
                  OFERTA EXCLUSIVA DE LANÇAMENTO
                </Badge>
                
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
                  Seja um dos 100 Primeiros!
                </h2>
                
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  <div className="bg-accent/10 rounded-xl p-6">
                    <div className="bg-accent/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Clock className="h-8 w-8 text-accent-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-4 text-foreground">
                      30 Dias de Teste Gratuito
                    </h3>
                    <p className="text-muted-foreground">
                      Experimente o poder máximo da nossa plataforma. Comece hoje com 30 dias de teste gratuito do nosso Plano Mestre, com todos os recursos liberados. Sem compromisso, sem pedir cartão de crédito.
                    </p>
                  </div>
                  
                  <div className="bg-primary/10 rounded-xl p-6">
                    <div className="bg-primary/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <CreditCard className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-4 text-foreground">
                      50% de Desconto por 12 Meses
                    </h3>
                    <p className="text-muted-foreground">
                      Gostou do que viu? Para celebrar nosso lançamento, os 100 primeiros assinantes após o período de teste garantirão um desconto de 50% em qualquer plano por 12 meses!
                    </p>
                  </div>
                </div>
                
                {/* Elemento de Urgência */}
                <div className="bg-muted/50 rounded-lg p-4 mb-8">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Vagas preenchidas na oferta:</span>
                    <span className="text-lg font-bold text-primary">97/100</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300" 
                      style={{ width: '97%' }}
                    ></div>
                  </div>
                </div>
                
                <Button 
                  size="lg" 
                  className="text-lg px-12 py-4 h-auto"
                  onClick={() => setLocation('/cadastro')}
                  data-testid="button-cta-teste-gratis"
                >
                  QUERO MEU TESTE GRÁTIS DE 30 DIAS
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Seção de Planos */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Escolha o Plano Ideal para Sua Academia
                </h2>
                <p className="text-lg text-muted-foreground">
                  Todos os planos incluem teste gratuito e podem ser alterados a qualquer momento
                </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-8">
                {/* Plano Faixa Branca */}
                <Card className="relative">
                  <CardHeader className="text-center pb-4">
                    <h3 className="text-2xl font-bold text-foreground mb-2">Faixa Branca</h3>
                    <p className="text-muted-foreground mb-4">
                      Academias pequenas ou em início de operação
                    </p>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-foreground">R$ 79<span className="text-lg font-normal">/mês</span></div>
                      <div className="bg-accent/10 rounded-lg p-2">
                        <div className="text-2xl font-bold text-accent-foreground">R$ 39,50<span className="text-sm font-normal">/mês</span></div>
                        <div className="text-xs text-accent-foreground/80">durante o 1º ano!</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-primary" />
                        <span className="text-sm">Gestão de Alunos Completa</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-primary" />
                        <span className="text-sm">Agenda e Agendamento de Aulas</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-primary" />
                        <span className="text-sm">Controle de Presença</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-primary" />
                        <span className="text-sm">Controle Financeiro</span>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="text-center">
                        <div className="text-sm font-medium text-muted-foreground">Limite:</div>
                        <div className="text-lg font-bold text-foreground">Até 50 alunos ativos</div>
                      </div>
                    </div>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => setLocation('/cadastro')}
                      data-testid="button-plano-faixa-branca"
                    >
                      Começar Teste Grátis
                    </Button>
                  </CardContent>
                </Card>

                {/* Plano Faixa Preta - Destacado */}
                <Card className="relative border-2 border-primary shadow-lg scale-105">
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-6 py-1">
                      ⭐ O MAIS POPULAR
                    </Badge>
                  </div>
                  <CardHeader className="text-center pb-4 pt-8">
                    <h3 className="text-2xl font-bold text-foreground mb-2">Faixa Preta</h3>
                    <p className="text-muted-foreground mb-4">
                      Academias que buscam crescimento e profissionalização
                    </p>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-foreground">R$ 149<span className="text-lg font-normal">/mês</span></div>
                      <div className="bg-primary/10 rounded-lg p-2">
                        <div className="text-2xl font-bold text-primary">R$ 74,50<span className="text-sm font-normal">/mês</span></div>
                        <div className="text-xs text-primary/80">durante o 1º ano!</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-primary" />
                        <span className="text-sm">Tudo do plano Faixa Branca</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-primary" />
                        <span className="text-sm">Portal do Aluno completo</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-primary" />
                        <span className="text-sm">Controle Financeiro Completo</span>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="text-center">
                        <div className="text-sm font-medium text-muted-foreground">Limite:</div>
                        <div className="text-lg font-bold text-foreground">Até 200 alunos ativos</div>
                      </div>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => setLocation('/cadastro')}
                      data-testid="button-plano-faixa-preta"
                    >
                      Começar Teste Grátis
                    </Button>
                  </CardContent>
                </Card>

                {/* Plano Mestre */}
                <Card className="relative">
                  <CardHeader className="text-center pb-4">
                    <h3 className="text-2xl font-bold text-foreground mb-2">Mestre</h3>
                    <p className="text-muted-foreground mb-4">
                      Grandes academias ou redes com necessidades personalizadas
                    </p>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-foreground">Sob Consulta</div>
                      <div className="bg-accent/10 rounded-lg p-2">
                        <div className="text-lg font-bold text-accent-foreground">Condições especiais</div>
                        <div className="text-xs text-accent-foreground/80">para os 100 primeiros!</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-primary" />
                        <span className="text-sm">Tudo do plano Faixa Preta</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-primary" />
                        <span className="text-sm">Relatórios Avançados de Gestão</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-primary" />
                        <span className="text-sm">Automação de Pagamentos</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-primary" />
                        <span className="text-sm">Suporte Prioritário</span>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="text-center">
                        <div className="text-sm font-medium text-muted-foreground">Limite:</div>
                        <div className="text-lg font-bold text-foreground">Alunos ilimitados</div>
                      </div>
                    </div>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => setLocation('/cadastro')}
                      data-testid="button-plano-mestre"
                    >
                      Fale com um Especialista
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Tabela Comparativa */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Compare Todos os Recursos
                </h2>
                <p className="text-lg text-muted-foreground">
                  Veja em detalhes o que cada plano oferece
                </p>
              </div>
              
              <div className="bg-card rounded-xl p-6 shadow-lg overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-4 px-4 font-semibold text-foreground">Recursos</th>
                      <th className="text-center py-4 px-4 font-semibold text-foreground">Faixa Branca</th>
                      <th className="text-center py-4 px-4 font-semibold text-primary">Faixa Preta</th>
                      <th className="text-center py-4 px-4 font-semibold text-foreground">Mestre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-4 px-4 text-foreground">Gestão de Alunos</td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="py-4 px-4 text-foreground">Agenda e Aulas</td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="py-4 px-4 text-foreground">Controle de Presença</td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="py-4 px-4 text-foreground">Controle Financeiro</td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="py-4 px-4 text-foreground">Portal do Aluno</td>
                      <td className="py-4 px-4 text-center">-</td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="py-4 px-4 text-foreground">Relatórios Avançados</td>
                      <td className="py-4 px-4 text-center">-</td>
                      <td className="py-4 px-4 text-center">-</td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="py-4 px-4 text-foreground">Automação de Pagamentos</td>
                      <td className="py-4 px-4 text-center">-</td>
                      <td className="py-4 px-4 text-center">-</td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="py-4 px-4 text-foreground">Suporte Prioritário</td>
                      <td className="py-4 px-4 text-center">-</td>
                      <td className="py-4 px-4 text-center">-</td>
                      <td className="py-4 px-4 text-center"><Check className="h-5 w-5 text-primary mx-auto" /></td>
                    </tr>
                    <tr className="bg-muted/20">
                      <td className="py-4 px-4 text-foreground font-semibold">Limite de Alunos Ativos</td>
                      <td className="py-4 px-4 text-center font-semibold">Até 50</td>
                      <td className="py-4 px-4 text-center font-semibold text-primary">Até 200</td>
                      <td className="py-4 px-4 text-center font-semibold">Ilimitado</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Ainda tem dúvidas? Nós respondemos.
                </h2>
                <p className="text-lg text-muted-foreground">
                  As perguntas mais frequentes dos nossos clientes
                </p>
              </div>
              
              <div className="space-y-4">
                {/* FAQ 1 */}
                <div className="bg-card rounded-lg border">
                  <button
                    className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-muted/20 transition-colors"
                    onClick={() => toggleFaq('faq1')}
                    data-testid="faq-teste-gratuito"
                  >
                    <span className="font-semibold text-foreground">Posso fazer um teste gratuito?</span>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openFaq === 'faq1' ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === 'faq1' && (
                    <div className="px-6 pb-4">
                      <p className="text-muted-foreground">
                        Sim! Oferecemos um teste gratuito de 30 dias do nosso plano mais completo, o Plano Mestre. Você terá acesso a todas as funcionalidades para ver na prática como podemos transformar a gestão da sua academia. Não é necessário cartão de crédito para começar.
                      </p>
                    </div>
                  )}
                </div>

                {/* FAQ 2 */}
                <div className="bg-card rounded-lg border">
                  <button
                    className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-muted/20 transition-colors"
                    onClick={() => toggleFaq('faq2')}
                    data-testid="faq-contrato"
                  >
                    <span className="font-semibold text-foreground">Existe contrato de fidelidade?</span>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openFaq === 'faq2' ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === 'faq2' && (
                    <div className="px-6 pb-4">
                      <p className="text-muted-foreground">
                        Não. Acreditamos na liberdade de escolha. Nossos planos são mensais e você pode cancelar a qualquer momento, sem multas ou burocracia. A sua satisfação é a nossa única fidelidade.
                      </p>
                    </div>
                  )}
                </div>

                {/* FAQ 3 */}
                <div className="bg-card rounded-lg border">
                  <button
                    className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-muted/20 transition-colors"
                    onClick={() => toggleFaq('faq3')}
                    data-testid="faq-mudar-plano"
                  >
                    <span className="font-semibold text-foreground">Posso mudar de plano a qualquer momento?</span>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openFaq === 'faq3' ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === 'faq3' && (
                    <div className="px-6 pb-4">
                      <p className="text-muted-foreground">
                        Com certeza! Você pode fazer o upgrade ou downgrade do seu plano diretamente na plataforma, de forma simples e rápida. O sistema se ajusta às suas necessidades conforme sua academia cresce.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* CTA Final */}
              <div className="text-center mt-16">
                <Button 
                  size="lg" 
                  className="text-lg px-12 py-4 h-auto"
                  onClick={() => setLocation('/cadastro')}
                  data-testid="button-cta-final"
                >
                  Começar Meu Teste Gratuito Agora
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}