(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STLPinterestModel=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const ORDERING='historical-rule-current-unverified';
 const numericId=value=>typeof value==='string'||typeof value==='number'&&Number.isSafeInteger(value)?(/^\d{1,40}$/.test(String(value))?String(value):null):null;
 function allowedImageURL(value){
  if(typeof value!=='string'||value.length>2048)return false;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&!u.hash&&/^(?:i|img\d)\.etsystatic\.com$/.test(u.hostname);}catch{return false;}
 }
 function selectPrimaryImage(images){
  const result=(status,reason,extra={})=>({status,imageId:null,rank:null,url:null,width:null,height:null,orderingVerification:ORDERING,reason,...extra});
  if(!Array.isArray(images))return result('missing','Etsy görsel sıra verisi yok; başka görsel seçilmedi.');
  const first=images.filter(image=>image&&image.rank===1);
  if(!first.length)return result('missing','Sayısal rank 1 görseli yok; başka görsel seçilmedi.');
  if(first.length!==1)return result('ambiguous','Birden fazla rank 1 görseli var; sıra belirsiz.');
  const image=first[0],imageId=numericId(image.listing_image_id??image.imageId??image.id);
  if(!imageId)return result('unavailable','Rank 1 görsel kimliği eksik veya geçersiz.');
  // Etsy's fixed-size thumbnails can crop the original. Only retain a full
  // image or its proportional 570xN rendition from this exact rank 1 record.
  const url=[image.url_fullxfull,image.url_570xN].find(allowedImageURL);
  if(!url)return result('unavailable','Rank 1 görselinin güvenli Etsy CDN adresi yok.',{imageId,rank:1});
  return result('rank-1','Tarihsel Etsy rank 1 kuralı; güncel resmî sıra sözleşmesi doğrulanmadı.',{imageId,rank:1,url,width:Number.isFinite(image.full_width)&&image.full_width>0?image.full_width:null,height:Number.isFinite(image.full_height)&&image.full_height>0?image.full_height:null});
 }
 function istanbulDay(now=Date.now()){
  const date=new Date(now);if(!Number.isFinite(date.getTime()))throw Error('Geçersiz gün zamanı.');
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),get=type=>parts.find(p=>p.type===type).value;
  return get('year')+'-'+get('month')+'-'+get('day');
 }
 function safeText(value,max){
  if(typeof value!=='string')return '';
  return Array.from(value.replace(/https?:\/\/\S+|www\.\S+|\b\S+@\S+\.\S+\b/gi,'').replace(/\b(?:access[_ -]?token|refresh[_ -]?token|app[_ -]?secret|client[_ -]?secret|authorization|password|customer[_ -]?(?:name|email))\s*[:=]\s*\S+/gi,'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()).slice(0,max).join('');
 }
 function buildPinContent(product,facts){
  if(!product||typeof product!=='object')throw Error('Ürün bilgisi gerekiyor.');
  const id=numericId(product.listing_id??product.listingId??product.id);if(!id)throw Error('Sayısal Etsy ilan kimliği gerekiyor.');
  const title=safeText(product.title,100)||'Digital STL file';
  let description='Digital STL file for 3D printing. No physical item will be shipped. View the Etsy listing for product details.';
  let alt_text='Product image from the Etsy listing: '+title;
  if(facts?.confirmed===true){
   const subject=safeText(facts.subject,160),appearance=safeText(facts.appearance,240);
   // Only explicitly confirmed visual facts are consumed. Product descriptions,
   // delivery files, customer records, and compatibility/licence claims are not.
   if(subject)description=subject+'. '+description;
   if(subject||appearance)alt_text=[subject,appearance].filter(Boolean).join('. ');
  }
  return {title,description:safeText(description,800),link:'https://www.etsy.com/listing/'+id,alt_text:safeText(alt_text,500)};
 }
 function pinterestPinURL(value){
  if(typeof value!=='string'||value.length>2048)return null;
  try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||!['www.pinterest.com','pinterest.com'].includes(u.hostname))return null;const m=u.pathname.match(/^\/pin\/(\d{1,40})\/?$/);return m?{id:m[1],url:'https://www.pinterest.com/pin/'+m[1]+'/'}:null;}catch{return null;}
 }
 return {selectPrimaryImage,istanbulDay,buildPinContent,allowedImageURL,pinterestPinURL,numericId,orderingVerification:ORDERING};
});
