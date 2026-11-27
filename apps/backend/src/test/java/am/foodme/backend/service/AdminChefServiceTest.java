package am.foodme.backend.service;

import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Chef;
import am.foodme.backend.repository.ChefRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminChefServiceTest {

    @Mock
    private ChefRepository chefRepository;

    private AdminChefService service;

    @BeforeEach
    void setUp() {
        service = new AdminChefService(chefRepository);
    }

    private static Chef chef(Long id, Double rating, String name) {
        Chef chef = new Chef();
        chef.setId(id);
        chef.setRating(rating);
        chef.setFullNameEn(name);
        return chef;
    }

    @Test
    void update_ratingInRequest_keepsStoredRating() {
        when(chefRepository.findById(5L)).thenReturn(Optional.of(chef(5L, 4.3, "Old name")));
        when(chefRepository.save(any(Chef.class))).thenAnswer(inv -> inv.getArgument(0));

        Chef updated = service.update(5L, chef(null, 1.0, "New name"));

        assertThat(updated.getId()).isEqualTo(5L);
        assertThat(updated.getRating()).isEqualTo(4.3);
        assertThat(updated.getFullNameEn()).isEqualTo("New name");
    }

    @Test
    void update_ratingMissingInRequest_keepsStoredRating() {
        when(chefRepository.findById(5L)).thenReturn(Optional.of(chef(5L, 4.3, "Old name")));
        when(chefRepository.save(any(Chef.class))).thenAnswer(inv -> inv.getArgument(0));

        Chef updated = service.update(5L, chef(null, null, "Old name"));

        assertThat(updated.getRating()).isEqualTo(4.3);
    }

    @Test
    void update_unknownChef_notFound() {
        when(chefRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(99L, chef(null, 5.0, "X")))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Chef 99 not found");
        verify(chefRepository, never()).save(any());
    }
}
