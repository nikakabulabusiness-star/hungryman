// CMS-ready content records. Replace this adapter with the future admin API.
export const site = {
  name: 'Hungryman',
  youtube: 'https://www.youtube.com/@hungrymantv',
  careers: 'https://team.hungryman.ge',
  businessEmail: 'info@hungryman.ge',
  feedbackEndpoint: '/api/feedback',
  socials: [
    { name: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com/@hungrymantv' },
    { name: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/hungrymantv/' },
    { name: 'TikTok', icon: 'tiktok', url: 'https://www.tiktok.com/@hungryman.ge' },
    { name: 'Facebook', icon: 'facebook', url: 'https://www.facebook.com/hungrymanfb/' },
  ],
  home: {
    title: 'HUNGRYMAN',
    description: 'ვიდეოები, გამოწვევები, თავგადასავლები და ყველაფერი Hungryman-ის სამყაროდან.',
    subscribers: '600K+',
  },
};

export const products = [
  { id:'original-tee', name:'Original T-Shirt', category:'მაისურები', price:69, frame:0, sizes:['S','M','L','XL','XXL'], description:'ყოველდღიური სტილი, Hungryman-ის ხასიათით. კლასიკური შავი მაისურის კონცეფცია ბრენდის მინიმალისტური პრინტით.', label:'ORIGINALS', active:true },
  { id:'signature-hoodie', name:'Signature Hoodie', category:'ჰუდები', price:129, frame:1, sizes:['S','M','L','XL','XXL'], description:'თავგადასავლებისთვის და ყოველდღიური კომფორტისთვის. თავისუფალი სილუეტის შავი ჰუდის კონცეფცია.', label:'ESSENTIALS', active:true },
  { id:'everyday-cap', name:'Everyday Cap', category:'ქუდები', price:59, frame:2, sizes:['რეგულირებადი'], description:'ერთი პატარა დეტალი, რომელიც ყველაფერს ცვლის. შავი კეპის კონცეფცია Hungryman-ის ბრენდირებით.', label:'ESSENTIALS', active:true },
  { id:'little-hungryman', name:'Little Hungryman', category:'სათამაშოები', price:89, frame:3, sizes:[], description:'Hungryman-ის სამყაროს პატარა წევრი. საკოლექციო რბილი სათამაშოს კონცეფცია.', label:'COLLECTIBLES', active:true },
  { id:'logo-keychain', name:'Hungryman ბრელოკი', category:'აქსესუარები', price:null, frame:4, sizes:[], description:'Hungryman-ის პერსონაჟის ბრელოკი მუქი ლურჯი და წითელი საკიდით.', label:'ACCESSORIES', active:true },
  { id:'adventure-bottle', name:'Hungryman თერმობოთლი', category:'აქსესუარები', price:null, frame:5, sizes:[], description:'მუქი ლურჯი თერმობოთლის კონცეფცია, წითელი აქცენტითა და Hungryman-ის ლოგოთი.', label:'ACCESSORIES', active:true },
];

// No casting has been confirmed active. Inactive records never appear publicly.
export const castings = [];

export const campaignTypes = [
  {id:'integration', number:'01', title:'პროდუქტის ინტეგრაცია', en:'Product Integration', icon:'box', text:'შენი პროდუქტი ხდება ვიდეოს ისტორიის ბუნებრივი ნაწილი — გამოყენებით, გამოცდილებით და რეალური ემოციებით.'},
  {id:'sponsor', number:'02', title:'ვიდეოს სპონსორი', en:'Video Sponsor', icon:'play', text:'ბრენდისთვის გამოყოფილი სეგმენტი სრულ ეპიზოდში, ვიდეოს თემასა და აუდიტორიაზე მორგებული გზავნილით.'},
  {id:'challenge', number:'03', title:'ბრენდირებული გამოწვევა', en:'Branded Challenge', icon:'flag', text:'გამოწვევა, რომლის ცენტრშიც შენი ბრენდი დგას — იდეიდან მასშტაბურ შესრულებამდე.'},
  {id:'placement', number:'04', title:'პროდუქტის განთავსება', en:'Product Placement', icon:'camera', text:'პროდუქტი, მანქანა ან ბრენდის ვიზუალური ელემენტი ჩვენს კადრში, მოქმედების ორგანულ ნაწილად.'},
  {id:'social', number:'05', title:'სოციალური კამპანია', en:'Social Campaign', icon:'share', text:'კამპანია YouTube Shorts-ში, Instagram-ზე, TikTok-სა და Facebook-ზე — თითოეულ პლატფორმაზე მორგებული ფორმატით.'},
  {id:'custom', number:'06', title:'ინდივიდუალური პროექტი', en:'Custom Project', icon:'spark', text:'განსხვავებული იდეა გაქვს? შევქმნათ შენი ბრენდისთვის ახალი ფორმატი, ისტორია ან სპეციალური პროექტი.'},
];

export const feedbackCategories = ['ვიდეოს იდეა','საიტის გაუმჯობესება','პროდუქტის იდეა','სხვა'];
