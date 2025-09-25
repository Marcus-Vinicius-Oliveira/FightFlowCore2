import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/Navbar";
import { 
  Users, 
  Calendar, 
  GraduationCap, 
  DollarSign, 
  Shield, 
  Search, 
  BookOpen, 
  Clock, 
  CheckCircle, 
  BarChart3, 
  Lock,
  ArrowRight,
  Eye,
  CreditCard,
  FileText
} from "lucide-react";
import { useLocation } from "wouter";

export default function Recursos() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-16">
        {/* Header Section */}
        <section className="bg-gradient-to-br from-primary/5 via-background to-accent/10 py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
              Uma Plataforma Completa para Transformar 
              <span className="block text-primary">a Gestão da Sua Academia</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
              Descubra todas as ferramentas que o FightFlowCore oferece para otimizar sua operação, 
              engajar seus alunos e impulsionar seu crescimento.
            </p>
          </div>
        </section>

        {/* Gestão de Alunos */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                    Centralize a Gestão de Alunos em um Único Lugar
                  </h2>
                  <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                    Diga adeus às planilhas complicadas. Tenha o perfil completo de cada aluno, 
                    com histórico e informações de contato, a um clique de distância.
                  </p>
                  
                  <div className="space-y-6">
                    <div className="flex items-start space-x-4">
                      <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Perfis completos e personalizáveis</h3>
                        <p className="text-muted-foreground">Mantenha todas as informações dos alunos organizadas em um só lugar.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
                        <GraduationCap className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Acompanhamento de progresso com histórico de faixas</h3>
                        <p className="text-muted-foreground">Registre graduações e acompanhe a evolução de cada aluno.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
                        <Search className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Busca e filtros avançados</h3>
                        <p className="text-muted-foreground">Encontre qualquer aluno instantaneamente com filtros inteligentes.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
                        <CheckCircle className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Controle de matrículas ativas e inativas</h3>
                        <p className="text-muted-foreground">Gerencie o status de cada aluno com facilidade.</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-primary/5 to-accent/10 dark:from-primary/10 dark:to-accent/20 rounded-2xl p-8 border">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="bg-primary rounded-full p-2">
                          <Users className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <h4 className="font-semibold">Lista de Alunos</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                              <span className="text-accent-foreground font-semibold text-sm">MA</span>
                            </div>
                            <div>
                              <p className="font-medium">Maria Silva</p>
                              <p className="text-sm text-muted-foreground">Faixa Azul - Jiu-Jitsu</p>
                            </div>
                          </div>
                          <Badge variant="secondary">Ativo</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                              <span className="text-primary font-semibold text-sm">JS</span>
                            </div>
                            <div>
                              <p className="font-medium">João Santos</p>
                              <p className="text-sm text-muted-foreground">Faixa Roxa - Karatê</p>
                            </div>
                          </div>
                          <Badge variant="secondary">Ativo</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Agenda e Aulas */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="order-2 lg:order-1">
                  <div className="bg-gradient-to-br from-accent/10 dark:from-accent/20 to-primary/5 dark:to-primary/10 rounded-2xl p-8 border">
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="bg-primary rounded-full p-2">
                            <Calendar className="h-5 w-5 text-primary-foreground" />
                          </div>
                          <h4 className="font-semibold">Grade Semanal</h4>
                        </div>
                        <div className="grid grid-cols-7 gap-2 mb-4">
                          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
                            <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                              {day}
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <div className="bg-primary/10 text-primary p-2 rounded text-sm">
                            <div className="font-medium">Jiu-Jitsu Adulto</div>
                            <div className="text-xs opacity-80">19:00 - 20:30</div>
                          </div>
                          <div className="bg-accent/10 text-accent-foreground p-2 rounded text-sm">
                            <div className="font-medium">Karatê Infantil</div>
                            <div className="text-xs opacity-80">17:00 - 18:00</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                
                <div className="order-1 lg:order-2">
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                    Organize Suas Aulas e Horários com Facilidade
                  </h2>
                  <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                    Crie e gerencie sua grade de horários com uma interface visual e intuitiva. 
                    Seus professores e alunos sempre saberão onde e quando precisam estar.
                  </p>
                  
                  <div className="space-y-6">
                    <div className="flex items-start space-x-4">
                      <div className="bg-accent/20 rounded-full p-2 flex-shrink-0">
                        <Calendar className="h-6 w-6 text-accent-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Calendário visual com grade semanal</h3>
                        <p className="text-muted-foreground">Interface intuitiva para organizar todas as aulas da academia.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-accent/20 rounded-full p-2 flex-shrink-0">
                        <CheckCircle className="h-6 w-6 text-accent-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Controle de presença digital</h3>
                        <p className="text-muted-foreground">Professores marcam presença diretamente pelo sistema.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-accent/20 rounded-full p-2 flex-shrink-0">
                        <Users className="h-6 w-6 text-accent-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Gestão de turmas e modalidades</h3>
                        <p className="text-muted-foreground">Organize turmas por modalidade e associe professores.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-accent/20 rounded-full p-2 flex-shrink-0">
                        <Clock className="h-6 w-6 text-accent-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Visão clara para evitar conflitos</h3>
                        <p className="text-muted-foreground">Evite sobreposições de horários automaticamente.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Portal do Aluno */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                    Engaje, Comunique e Retenha Seus Alunos
                  </h2>
                  <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                    Ofereça uma experiência profissional aos seus membros com um portal exclusivo, 
                    fortalecendo a comunidade e aumentando a taxa de retenção.
                  </p>
                  
                  <div className="space-y-6">
                    <div className="flex items-start space-x-4">
                      <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
                        <Lock className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Acesso pessoal e seguro</h3>
                        <p className="text-muted-foreground">Cada aluno tem seu login exclusivo e dados protegidos.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
                        <Calendar className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Visualização de horários das turmas</h3>
                        <p className="text-muted-foreground">Alunos veem apenas as aulas em que estão matriculados.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
                        <BarChart3 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Histórico de frequência e progresso</h3>
                        <p className="text-muted-foreground">Acompanhe sua evolução e frequência nas aulas.</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-primary/5 to-accent/10 dark:from-primary/10 dark:to-accent/20 rounded-2xl p-8 border">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="bg-primary rounded-full p-2">
                          <GraduationCap className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <h4 className="font-semibold">Portal do Aluno</h4>
                      </div>
                    
                    <div className="space-y-4">
                      <div className="bg-primary/10 p-4 rounded-lg">
                        <h5 className="font-medium text-primary mb-2">Próximas Aulas</h5>
                        <div className="text-sm text-primary/80">
                          <div className="flex justify-between">
                            <span>Jiu-Jitsu Adulto</span>
                            <span>Hoje 19:00</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-accent/10 p-4 rounded-lg">
                        <h5 className="font-medium text-accent-foreground mb-2">Frequência do Mês</h5>
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div className="bg-accent h-2 rounded-full" style={{ width: '75%' }}></div>
                          </div>
                          <span className="text-sm text-accent-foreground/80">75%</span>
                        </div>
                      </div>
                      
                      <div className="bg-accent/10 p-4 rounded-lg">
                        <h5 className="font-medium text-accent-foreground mb-2">Faixa Atual</h5>
                        <div className="text-sm text-accent-foreground/80">
                          Faixa Azul - Jiu-Jitsu
                        </div>
                      </div>
                    </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Controle Financeiro */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="order-2 lg:order-1">
                  <div className="bg-gradient-to-br from-green-50/50 dark:from-green-950/20 to-primary/5 dark:to-primary/10 rounded-2xl p-8 border">
                    <Card>
                      <CardContent className="p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="bg-green-500 rounded-full p-2">
                          <DollarSign className="h-5 w-5 text-white" />
                        </div>
                        <h4 className="font-semibold">Resumo Financeiro</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-accent/10 p-3 rounded-lg text-center">
                          <div className="text-2xl font-bold text-accent-foreground">R$ 12.450</div>
                          <div className="text-sm text-accent-foreground/80">Recebido</div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg text-center">
                          <div className="text-2xl font-bold text-red-600 dark:text-red-400">R$ 1.680</div>
                          <div className="text-sm text-red-700 dark:text-red-300">Pendente</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-muted rounded">
                          <span className="text-sm">Mensalidades Pagas</span>
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">89%</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-muted rounded">
                          <span className="text-sm">Em Atraso</span>
                          <span className="text-sm font-medium text-red-600 dark:text-red-400">6</span>
                        </div>
                      </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                
                <div className="order-1 lg:order-2">
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                    Tenha a Saúde Financeira na Palma da Mão
                  </h2>
                  <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                    Simplifique a gestão de mensalidades e tenha uma visão clara sobre 
                    a situação financeira da sua academia.
                  </p>
                  
                  <div className="space-y-6">
                    <div className="flex items-start space-x-4">
                      <div className="bg-accent/20 rounded-full p-2 flex-shrink-0">
                        <FileText className="h-6 w-6 text-accent-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Planos de matrícula flexíveis</h3>
                        <p className="text-muted-foreground">Crie planos mensais, trimestrais ou anuais.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-accent/20 rounded-full p-2 flex-shrink-0">
                        <BarChart3 className="h-6 w-6 text-accent-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Acompanhamento de pagamentos</h3>
                        <p className="text-muted-foreground">Registre e monitore o status de cada pagamento.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-accent/20 rounded-full p-2 flex-shrink-0">
                        <Eye className="h-6 w-6 text-accent-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Relatórios de faturamento</h3>
                        <p className="text-muted-foreground">Visualize receitas e inadimplência de forma clara.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-orange-100 rounded-full p-2 flex-shrink-0">
                        <CreditCard className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">
                          <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs mr-2">Em Breve</span>
                          Automação de cobranças
                        </h3>
                        <p className="text-muted-foreground">PIX, Boleto e Cartão de Crédito automáticos.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Segurança */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Seus Dados, Sua Academia: Segurança em Primeiro Lugar
              </h2>
              <p className="text-lg text-muted-foreground mb-12 leading-relaxed">
                Construímos nossa plataforma sobre uma arquitetura de nível empresarial para garantir 
                que suas informações estejam sempre seguras e disponíveis.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-primary/10 rounded-2xl p-8 border">
                  <div className="bg-blue-500 rounded-full p-4 w-16 h-16 mx-auto mb-6">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-4">Isolamento Multi-Tenant</h3>
                  <p className="text-muted-foreground">
                    Dados de cada academia completamente separados e protegidos.
                  </p>
                </div>
                
                <div className="bg-accent/10 rounded-2xl p-8 border">
                  <div className="bg-green-500 rounded-full p-4 w-16 h-16 mx-auto mb-6">
                    <BookOpen className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-4">Backups Automáticos</h3>
                  <p className="text-muted-foreground">
                    Seus dados são protegidos com backups redundantes diários.
                  </p>
                </div>
                
                <div className="bg-accent/10 rounded-2xl p-8 border">
                  <div className="bg-primary rounded-full p-4 w-16 h-16 mx-auto mb-6">
                    <Lock className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-4">Criptografia Completa</h3>
                  <p className="text-muted-foreground">
                    Todas as comunicações protegidas com criptografia de ponta a ponta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-20 bg-gradient-to-br from-primary/5 via-background to-accent/10 dark:from-primary/10 dark:to-accent/20">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Pronto para Levar sua Academia para o Próximo Nível?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Junte-se às academias que já transformaram sua gestão com nossa plataforma.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="text-lg px-8 py-3"
                  onClick={() => setLocation('/cadastro')}
                  data-testid="button-cta-comece-gratis"
                >
                  Comece Grátis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 py-3 border-primary text-primary hover:bg-primary/5"
                  onClick={() => console.log('Ver demonstração clicked')}
                  data-testid="button-cta-ver-demonstracao"
                >
                  Ver Demonstração
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}