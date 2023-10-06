document.querySelectorAll('#sticky a').forEach(link => {
    link.addEventListener('click', e => {
        var tgt = link.getAttribute("href");
        
        if(tgt.includes('#')) {
            e.preventDefault();
            document.querySelector(tgt).scrollIntoView({ 'behavior': 'smooth'});
        } 
    });
})
