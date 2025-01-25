import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Calendar, Eye, MessageCircle, TrendingUp, Home, PlusCircle, Settings, 
  User, PauseCircle, PlayCircle, Trash2, Tag, X, MoreHorizontal, Info
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Composants des drapeaux
const FlagFR = () => (
  <svg className="w-full h-full rounded-full" viewBox="0 0 512 512">
    <path fill="#ED2939" d="M0 0h512v512H0z"/>
    <path fill="#FFFFFF" d="M0 0h341.3v512H0z"/>
    <path fill="#002395" d="M0 0h170.7v512H0z"/>
  </svg>
);

const FlagGB = () => (
  <svg className="w-full h-full rounded-full" viewBox="0 0 512 512">
    <path fill="#012169" d="M0 0h512v512H0z"/>
    <path fill="#FFF" d="M512 0v64L322 256l190 187v69h-67L254 324 68 512H0v-68l186-187L0 74V0h62l192 188L440 0z"/>
    <path fill="#C8102E" d="M184 324l11 34L42 512H0v-3l184-185zm124-12l54 8 150 147v45L308 312zM512 0L320 196l-4-44L466 0h46zM0 1l193 189-59-8L0 49V1z"/>
    <path fill="#FFF" d="M176 0v512h160V0H176zM0 176v160h512V176H0z"/>
    <path fill="#C8102E" d="M0 208v96h512v-96H0zM208 0v512h96V0h-96z"/>
  </svg>
);

const FlagQA = () => (
  <svg className="w-full h-full rounded-full" viewBox="0 0 512 512">
    <path fill="#FFFFFF" d="M0 0h512v512H0z"/>
    <path fill="#8A1538" d="M512 0v512H114.72L177.04 426.67 114.72 341.33l62.32-85.33-62.32-85.33L177.04 85.33 114.72 0z"/>
  </svg>
);

const ActiveListings = () => {
  const [currentView, setCurrentView] = useState('active-listings');
  const [language, setLanguage] = useState('fr');
  const [hoveredFlag, setHoveredFlag] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState(null);
  const menuRef = useRef(null);

  const [listings, setListings] = useState(Array(12).fill().map(() => ({ 
    status: 'active',
    postDate: '15/01',
    soldDate: null,
    price: 4500,
    views: 156,
    messages: 12,
    unreadMessages: 3,
    bestOffer: 4200
  })));

  const translations = {
    fr: {
      dashboard: "Tableau de bord",
      newListing: "Nouvelle annonce",
      datePosted: "Mise en ligne",
      views: "Vues",
      messages: "Messages",
      bestOffer: "Meilleure offre",
      settings: "Paramètres",
      activeListings: "Annonces actives",
      inactiveListings: "Annonces en pause",
      soldListings: "Annonces vendues",
      sold: "VENDU",
      pause: "Mettre en pause",
      resume: "Réactiver",
      delete: "Supprimer",
      markAsSold: "Marquer comme vendu",
      confirmDelete: "Confirmer la suppression",
      deleteWarning: "Êtes-vous sûr de vouloir supprimer cette annonce ? Cette action est irréversible.",
      cancel: "Annuler",
      confirm: "Confirmer",
      soldIn: "Vendu en"
    }
  };

  const t = translations[language];

  const handleMessageClick = (index) => {
    console.log(`Navigating to messages for listing ${index}`);
  };

  const handleDetailsClick = (index) => {
    console.log(`Navigating to details for listing ${index}`);
  };

  const handleBestOfferClick = (index) => {
    console.log(`Navigating to best offer conversation for listing ${index}`);
  };

  const calculateSaleDuration = (postDateStr, soldDateStr) => {
    const [postDay, postMonth] = postDateStr.split('/');
    const [soldDay, soldMonth] = soldDateStr.split('/');
    const startDate = new Date(2024, parseInt(postMonth) - 1, parseInt(postDay));
    const endDate = new Date(2024, parseInt(soldMonth) - 1, parseInt(soldDay));
    const diffTime = Math.abs(endDate - startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleStatusChange = (index, newStatus) => {
    const newListings = [...listings];
    newListings[index] = { 
      ...newListings[index], 
      status: newStatus,
      soldDate: newStatus === 'sold' ? new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit'
      }) : null
    };
    setListings(newListings);
    setSelectedCard(null);
  };

  const handleDelete = (index) => {
    setSelectedForDeletion(index);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    setListings(listings.filter((_, index) => index !== selectedForDeletion));
    setShowDeleteDialog(false);
    setSelectedCard(null);
  };

  const getCardActions = (index) => {
    const listing = listings[index];
    if (listing.status === 'active') {
      return [
        { icon: PauseCircle, text: t.pause, action: () => handleStatusChange(index, 'paused'), class: 'text-orange-500' },
        { icon: Tag, text: t.markAsSold, action: () => handleStatusChange(index, 'sold'), class: 'text-green-600' },
        { icon: Trash2, text: t.delete, action: () => handleDelete(index), class: 'text-red-500' }
      ];
    } else if (listing.status === 'paused') {
      return [
        { icon: PlayCircle, text: t.resume, action: () => handleStatusChange(index, 'active'), class: 'text-green-600' },
        { icon: Tag, text: t.markAsSold, action: () => handleStatusChange(index, 'sold'), class: 'text-green-600' },
        { icon: Trash2, text: t.delete, action: () => handleDelete(index), class: 'text-red-500' }
      ];
    }
    return [
      { icon: Trash2, text: t.delete, action: () => handleDelete(index), class: 'text-red-500' }
    ];
  };

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-[#8A1538] to-[#8A1538]/80">
      {/* Header */}
      <div className="fixed top-0 w-full bg-white/80 backdrop-blur z-40">
        <div className="h-16 flex justify-between items-center px-4">
          <div className="text-xl font-bold">
            <span className="text-[#8A1538]">Marketplace</span> Qatar
          </div>

          <div className="flex items-center gap-2 p-2">
            {[
              { code: 'fr', Flag: FlagFR, title: 'Français' },
              { code: 'en', Flag: FlagGB, title: 'English' },
              { code: 'ar', Flag: FlagQA, title: 'العربية' }
            ].map(({ code, Flag, title }) => (
              <div
                key={code}
                onClick={() => setLanguage(code)}
                onMouseEnter={() => setHoveredFlag(code)}
                onMouseLeave={() => setHoveredFlag(null)}
                className={`w-8 h-8 cursor-pointer transition-all duration-200 rounded-full overflow-hidden
                  ${language === code || hoveredFlag === code 
                    ? 'ring-2 ring-[#8A1538] scale-110 shadow-lg' 
                    : 'hover:scale-105'}`}
                title={title}
              >
                <Flag />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer bg-white/50 hover:bg-[#8A1538] hover:text-white hover:scale-105 transition-all">
              <Settings size={24} />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer bg-white/50 hover:bg-[#8A1538] hover:text-white hover:scale-105 transition-all">
              <User size={24} />
            </div>
          </div>
        </div>

        <div className="w-full bg-[#8A1538]/10 py-3 text-center">
          <h1 className="text-2xl font-bold text-[#8A1538]">ANNONCES</h1>
        </div>
      </div>

      {/* Menu latéral */}
      <div className="fixed top-28 left-0 w-64 h-[calc(100vh-7rem)] bg-white/90 backdrop-blur border-r border-white/20">
        <nav className="mt-4 space-y-6">
          <div className="bg-white/50 rounded-lg mx-2 p-2">
            {[
              { icon: Home, text: t.dashboard, view: 'dashboard' },
              { icon: PlusCircle, text: t.newListing, view: 'new-listing' }
            ].map(({ icon: Icon, text, view }) => (
              <div
                key={view}
                onClick={() => setCurrentView(view)}
                className={`flex items-center gap-2 px-4 py-3 cursor-pointer rounded-lg transition-all duration-200
                  ${currentView === view
                    ? 'bg-[#8A1538]/10 text-[#8A1538] font-bold scale-105' 
                    : 'hover:bg-[#8A1538] hover:text-white hover:font-bold hover:scale-105'}`}
              >
                <Icon size={20} />
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="px-4 mb-2 text-sm font-semibold text-gray-500">
              Annonces
            </div>
            <div className="bg-white/50 rounded-lg mx-2 p-2">
              {[
                { text: t.activeListings, view: 'active-listings', count: listings.filter(l => l.status === 'active').length },
                { text: t.inactiveListings, view: 'inactive-listings', count: listings.filter(l => l.status === 'paused').length },
                { text: t.soldListings, view: 'sold-listings', count: listings.filter(l => l.status === 'sold').length }
              ].map(({ text, view, count }) => (
                <div
                  key={view}
                  onClick={() => setCurrentView(view)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer rounded-lg transition-all duration-300
                    ${currentView === view
                      ? 'bg-[#8A1538]/10 text-[#8A1538] font-bold scale-105' 
                      : 'hover:bg-[#8A1538] hover:text-white hover:font-extrabold hover:scale-110 hover:shadow-lg'}`}
                >
                  <span>{text}</span>
                  <span className="bg-[#8A1538]/20 px-2 py-0.5 rounded-full text-sm">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </nav>
      </div>

      {/* Contenu principal */}
      <div className="ml-64 p-4 pt-32">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {listings
            .filter(listing => {
              if (currentView === 'active-listings') return listing.status === 'active';
              if (currentView === 'inactive-listings') return listing.status === 'paused';
              if (currentView === 'sold-listings') return listing.status === 'sold';
              return true;
            })
            .map((listing, index) => (
            <Card 
              key={index} 
              className="relative bg-white/80 backdrop-blur transition-all duration-200 hover:scale-105"
            >
              <CardContent className="p-3">
                <div className="relative overflow-visible">
                  {/* Menu trois points */}
                  <div 
                    className="absolute top-2 left-2 z-50 bg-white/90 rounded-full p-1 cursor-pointer hover:scale-110 transition-all shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCard(selectedCard === index ? null : index);
                    }}
                  >
                    <MoreHorizontal size={20} />
                  </div>

                  {/* Menu contextuel */}
                  {selectedCard === index && (
                    <div className="absolute top-12 left-2 z-50 bg-white/95 backdrop-blur rounded-lg shadow-lg py-1 min-w-[150px]">
                      {getCardActions(index).map((action, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-gray-100 ${action.class}`}
                          onClick={action.action}
                        >
                          <action.icon size={16} />
                          <span>{action.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Container de l'image */}
                  <div className="relative h-32 mb-2 rounded-lg overflow-hidden">
                    <img 
                      src="/api/placeholder/400/300"
                      alt="Product"
                      className={`w-full h-full object-cover ${listing.status === 'paused' ? 'blur-sm' : ''}`}
                    />
                    {listing.status === 'paused' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <PauseCircle size={48} className="text-white" />
                      </div>
                    )}
                    {listing.status === 'sold' && (
                      <div className="absolute bottom-0 left-0 right-0 bg-red-100/90 text-red-600 text-center py-1 font-bold">
                        {t.sold}
                        {listing.soldDate && (
                          <div className="text-xs font-normal">
                            {t.soldIn} {calculateSaleDuration(listing.postDate, listing.soldDate)} jours
                          </div>
                        )}
                      </div>
                    )}
                    <div className="absolute top-1 right-1 bg-white/90 backdrop-blur px-2 py-0.5 rounded-full text-[#8A1538] font-bold text-sm">
                      {listing.price} QAR
                    </div>
                  </div>

                  <h3 className="text-sm font-bold mb-2 truncate">iPhone 15 Pro Max</h3>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar size={12} />
                        <span>{t.datePosted}: {listing.postDate}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <Eye size={12} />
                        <span>{listing.views}</span>
                      </div>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        {/* Messages à gauche */}
                        <a 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleMessageClick(index);
                          }}
                          style={{
                            display: 'inline-block',
                            transition: 'transform 0.3s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          className="relative flex items-center text-[#8A1538] transform-origin-left ml-2"
                        >
                          <MessageCircle size={16} />
                          <span className="text-lg font-semibold ml-1">{listing.messages}</span>
                          {listing.unreadMessages > 0 && (
                            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                              {listing.unreadMessages}
                            </div>
                          )}
                        </a>

                        {/* Prix à droite */}
                        <a 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleBestOfferClick(index);
                          }}
                          style={{
                            display: 'inline-block',
                            transition: 'transform 0.3s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          className="flex items-center text-green-600 mr-2"
                        >
                          <TrendingUp size={12} />
                          <span className="text-base font-bold ml-1">{listing.bestOffer} QAR</span>
                        </a>
                      </div>

                      {/* Info en dessous, centré */}
                      <div className="flex justify-center">
                        <a 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDetailsClick(index);
                          }}
                          style={{
                            display: 'inline-block',
                            transition: 'transform 0.3s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <Info size={24} className="text-[#8A1538]" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Dialogue de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteWarning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
              {t.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ActiveListings;
