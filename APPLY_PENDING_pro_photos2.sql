-- Two more unique portraits (removes the shared-image duplicates).
update public.professional_profiles set avatar_url = '/pros/hybridlash.jpg', cover_url = '/pros/hybridlash.jpg' where business_name = 'Lux Lash Bar';
update public.professional_profiles set avatar_url = '/pros/bob.jpg',        cover_url = '/pros/bob.jpg'        where business_name = 'Remy Cuts';
