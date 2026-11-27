package am.foodme.backend.service;

import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Chef;
import am.foodme.backend.repository.ChefRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
public class AdminChefService {

    private final ChefRepository chefRepository;

    public AdminChefService(ChefRepository chefRepository) {
        this.chefRepository = chefRepository;
    }

    public Page<Chef> list(int page, int size, String q) {
        if (q == null || q.isBlank()) {
            return chefRepository.findAll(PageRequest.of(page, size));
        }
        return chefRepository.findByUsernameContainingIgnoreCase(q, PageRequest.of(page, size));
    }

    public Chef getById(Long id) {
        return chefRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Chef " + id + " not found"));
    }

    public Chef update(Long id, Chef chef) {
        Chef existing = getById(id);
        chef.setId(id);
        // The rating is the average of customer reviews (KAN-9), so admins can't overwrite it.
        chef.setRating(existing.getRating());
        return chefRepository.save(chef);
    }
}
