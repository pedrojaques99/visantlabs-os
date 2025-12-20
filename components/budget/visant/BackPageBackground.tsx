import React from 'react';

interface BackPageBackgroundProps {
  accentColor?: string;
  opacity?: number;
}

export const BackPageBackground: React.FC<BackPageBackgroundProps> = ({
  accentColor = '#52ddeb',
  opacity = 0.3,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        opacity,
        pointerEvents: 'none',
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 595 842" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <path opacity="0.1" d="M316.512 71C316.512 70.6686 316.243 70.4 315.912 70.4H310.512C310.181 70.4 309.912 70.6686 309.912 71C309.912 71.3314 310.181 71.6 310.512 71.6L315.312 71.6L315.312 76.4C315.312 76.7314 315.581 77 315.912 77C316.243 77 316.512 76.7314 316.512 76.4V71ZM5.58154 381.331L6.00581 381.755L316.336 71.4243L315.912 71L315.488 70.5757L5.15728 380.906L5.58154 381.331Z" fill="url(#paint0_linear_backpage)"/>
        <path d="M572.813 277.103C572.813 276.771 572.545 276.503 572.213 276.503H566.813C566.482 276.503 566.213 276.771 566.213 277.103C566.213 277.434 566.482 277.703 566.813 277.703L571.613 277.703L571.613 282.503C571.613 282.834 571.882 283.103 572.213 283.103C572.545 283.103 572.813 282.834 572.813 282.503V277.103ZM261.883 587.433L262.307 587.857L572.638 277.527L572.213 277.103L571.789 276.678L261.459 587.009L261.883 587.433Z" fill="url(#paint1_linear_backpage)"/>
        <path d="M608.431 38.9526C608.431 38.6213 608.162 38.3526 607.831 38.3526H602.431C602.099 38.3526 601.831 38.6213 601.831 38.9526C601.831 39.284 602.099 39.5526 602.431 39.5526L607.231 39.5526L607.231 44.3526C607.231 44.684 607.499 44.9526 607.831 44.9526C608.162 44.9526 608.431 44.684 608.431 44.3526V38.9526ZM297.5 349.283L297.924 349.707L608.255 39.3769L607.831 38.9526L607.406 38.5284L297.076 348.859L297.5 349.283Z" fill="url(#paint2_linear_backpage)"/>
        <path d="M145.044 338.882C145.044 338.55 144.775 338.282 144.444 338.282H139.044C138.712 338.282 138.444 338.55 138.444 338.882C138.444 339.213 138.712 339.482 139.044 339.482L143.844 339.482L143.844 344.282C143.844 344.613 144.112 344.882 144.444 344.882C144.775 344.882 145.044 344.613 145.044 344.282V338.882ZM-165.887 649.212L-165.462 649.637L144.868 339.306L144.444 338.882L144.02 338.458L-166.311 648.788L-165.887 649.212Z" fill="url(#paint3_linear_backpage)"/>
        <path d="M333.211 -227.331C333.211 -227.662 332.942 -227.931 332.611 -227.931H327.211C326.879 -227.931 326.611 -227.662 326.611 -227.331C326.611 -226.999 326.879 -226.731 327.211 -226.731L332.011 -226.731L332.011 -221.931C332.011 -221.599 332.279 -221.331 332.611 -221.331C332.942 -221.331 333.211 -221.599 333.211 -221.931V-227.331ZM22.28 83L22.7043 83.4242L333.035 -226.906L332.611 -227.331L332.186 -227.755L21.8558 82.5757L22.28 83Z" fill="url(#paint4_linear_backpage)"/>
        <path d="M455.376 726.828C455.376 726.497 455.107 726.228 454.776 726.228H449.376C449.045 726.228 448.776 726.497 448.776 726.828C448.776 727.159 449.045 727.428 449.376 727.428L454.176 727.428L454.176 732.228C454.176 732.559 454.445 732.828 454.776 732.828C455.107 732.828 455.376 732.559 455.376 732.228V726.828ZM144.445 1037.16L144.87 1037.58L455.2 727.252L454.776 726.828L454.352 726.404L144.021 1036.73L144.445 1037.16Z" fill="url(#paint5_linear_backpage)"/>
        <defs>
          <linearGradient id="paint0_linear_backpage" x1="5.9351" y1="381.684" x2="316.266" y2="71.3535" gradientUnits="userSpaceOnUse">
            <stop stopColor={accentColor} stopOpacity="0"/>
            <stop offset="1" stopColor={accentColor}/>
          </linearGradient>
          <linearGradient id="paint1_linear_backpage" x1="262.236" y1="587.787" x2="572.567" y2="277.456" gradientUnits="userSpaceOnUse">
            <stop stopColor={accentColor} stopOpacity="0"/>
            <stop offset="1" stopColor={accentColor}/>
          </linearGradient>
          <linearGradient id="paint2_linear_backpage" x1="297.854" y1="349.637" x2="608.184" y2="39.3062" gradientUnits="userSpaceOnUse">
            <stop stopColor={accentColor} stopOpacity="0"/>
            <stop offset="1" stopColor={accentColor}/>
          </linearGradient>
          <linearGradient id="paint3_linear_backpage" x1="-165.533" y1="649.566" x2="144.797" y2="339.235" gradientUnits="userSpaceOnUse">
            <stop stopColor={accentColor} stopOpacity="0"/>
            <stop offset="1" stopColor={accentColor}/>
          </linearGradient>
          <linearGradient id="paint4_linear_backpage" x1="22.6336" y1="83.3535" x2="332.964" y2="-226.977" gradientUnits="userSpaceOnUse">
            <stop stopColor={accentColor} stopOpacity="0"/>
            <stop offset="1" stopColor={accentColor}/>
          </linearGradient>
          <linearGradient id="paint5_linear_backpage" x1="144.799" y1="1037.51" x2="455.129" y2="727.182" gradientUnits="userSpaceOnUse">
            <stop stopColor={accentColor} stopOpacity="0"/>
            <stop offset="1" stopColor={accentColor}/>
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

































